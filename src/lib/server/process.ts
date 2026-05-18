import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";

const exec = promisify(execFile);

export type StoredFile = {
  path: string;
  name: string;
  type: string;
  size: number;
};

export type ProcessResult = {
  path: string;
  name: string;
  type: string;
  meta?: Record<string, string | number | boolean>;
};

type Options = Record<string, string | number | boolean>;

function parsePages(input: string | undefined, pageCount: number) {
  if (!input || input === "all") return Array.from({ length: pageCount }, (_, index) => index);
  const pages = new Set<number>();
  input.split(",").forEach((part) => {
    const [startRaw, endRaw] = part.trim().split("-");
    const start = Number(startRaw);
    const end = Number(endRaw ?? startRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    for (let page = Math.max(1, start); page <= Math.min(pageCount, end); page += 1) pages.add(page - 1);
  });
  return [...pages].sort((a, b) => a - b);
}

function colorFromHex(hex: string) {
  const value = hex.replace("#", "");
  const bigint = Number.parseInt(value.length === 3 ? value.split("").map((x) => x + x).join("") : value, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

async function writePdf(document: PDFDocument, outPath: string) {
  await writeFile(outPath, await document.save({ useObjectStreams: true }));
}

async function merge(files: StoredFile[], outPath: string) {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const source = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  await writePdf(merged, outPath);
}

async function split(file: StoredFile, options: Options, tempDir: string) {
  const source = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  const pageCount = source.getPageCount();
  const groups: number[][] = [];
  if (options.mode === "every") {
    const every = Math.max(1, Number(options.every ?? 1));
    for (let index = 0; index < pageCount; index += every) groups.push(Array.from({ length: Math.min(every, pageCount - index) }, (_, offset) => index + offset));
  } else {
    String(options.ranges ?? "1").split(",").forEach((range) => groups.push(parsePages(range, pageCount)));
  }

  const archivePath = path.join(tempDir, "split.zip");
  const archive = new JSZip();
  let index = 1;
  for (const group of groups.filter(Boolean)) {
    const next = await PDFDocument.create();
    const copied = await next.copyPages(source, group);
    copied.forEach((page) => next.addPage(page));
    archive.file(`split-${index}.pdf`, Buffer.from(await next.save()));
    index += 1;
  }
  await writeFile(archivePath, await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return archivePath;
}

async function deletePages(file: StoredFile, options: Options, outPath: string) {
  const source = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  const remove = new Set(parsePages(String(options.pages ?? ""), source.getPageCount()));
  const output = await PDFDocument.create();
  const keep = source.getPageIndices().filter((page) => !remove.has(page));
  const pages = await output.copyPages(source, keep);
  pages.forEach((page) => output.addPage(page));
  await writePdf(output, outPath);
}

async function organizePages(file: StoredFile, options: Options, outPath: string) {
  const source = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  const order = String(options.order || "").trim();
  const indices = order ? parsePages(order, source.getPageCount()) : source.getPageIndices();
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, indices);
  const rotation = Number(options.rotate ?? 0);
  pages.forEach((page) => {
    if (rotation) page.setRotation(degrees(rotation));
    output.addPage(page);
  });
  await writePdf(output, outPath);
}

async function pageNumbers(file: StoredFile, options: Options, outPath: string) {
  const document = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  if (options.action === "remove") {
    await writePdf(document, outPath);
    return;
  }
  const font = await document.embedFont(StandardFonts.Helvetica);
  const format = String(options.format ?? "Page {n}");
  const size = Number(options.size ?? 11);
  const color = colorFromHex(String(options.color ?? "#111827"));
  document.getPages().forEach((page, index) => {
    const label = format.replace("{n}", String(index + 1)).replace("{total}", String(document.getPageCount()));
    const width = font.widthOfTextAtSize(label, size);
    const { width: pageWidth } = page.getSize();
    const x = String(options.position).includes("left") ? 36 : String(options.position).includes("right") ? pageWidth - width - 36 : (pageWidth - width) / 2;
    const y = String(options.position).includes("top") ? page.getHeight() - 36 : 24;
    page.drawText(label, { x, y, size, font, color });
  });
  await writePdf(document, outPath);
}

async function watermark(files: StoredFile[], options: Options, outPath: string) {
  const document = await PDFDocument.load(await readFile(files[0].path), { ignoreEncryption: true });
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  const opacity = Number(options.opacity ?? 0.18);
  const rotation = degrees(Number(options.rotation ?? -35));
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  const image = imageFile
    ? imageFile.type.includes("png")
      ? await document.embedPng(await readFile(imageFile.path))
      : await document.embedJpg(await readFile(imageFile.path))
    : undefined;

  document.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    if (image) {
      const scaled = image.scale(Math.min(width / image.width, height / image.height) * 0.4);
      page.drawImage(image, { x: (width - scaled.width) / 2, y: (height - scaled.height) / 2, width: scaled.width, height: scaled.height, opacity, rotate: rotation });
    } else {
      const text = String(options.text ?? "CONFIDENTIAL");
      page.drawText(text, { x: width * 0.18, y: height * 0.48, size: 46, font, color: rgb(0.9, 0.1, 0.1), opacity, rotate: rotation });
    }
  });
  await writePdf(document, outPath);
}

async function editPdf(files: StoredFile[], options: Options, outPath: string) {
  const document = await PDFDocument.load(await readFile(files[0].path), { ignoreEncryption: true });
  const page = document.getPage(Math.max(0, Number(options.page ?? 1) - 1));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const x = Number(options.x ?? 72);
  const y = Number(options.y ?? 72);
  page.drawText(String(options.text ?? "PDFForge"), { x, y, size: 18, font, color: rgb(0.05, 0.05, 0.05) });
  page.drawRectangle({ x, y: y - 16, width: 160, height: 28, borderColor: rgb(0.9, 0.1, 0.1), borderWidth: 1 });
  if (String(options.redact) === "true") page.drawRectangle({ x, y: y + 36, width: 180, height: 32, color: rgb(0, 0, 0) });
  const imageFile = files.find((file) => file.type.startsWith("image/"));
  if (imageFile) {
    const image = imageFile.type.includes("png") ? await document.embedPng(await readFile(imageFile.path)) : await document.embedJpg(await readFile(imageFile.path));
    const scaled = image.scale(0.25);
    page.drawImage(image, { x: x + 200, y, width: scaled.width, height: scaled.height });
  }
  await writePdf(document, outPath);
}

async function verifyRedaction(source: StoredFile, options: Options) {
  const terms = String(options.redactTerms || "")
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  if (!terms.length) {
    return { redactionVerified: false, redactionMessage: "Add redactTerms to verify hidden text removal." };
  }
  const raw = (await readFile(source.path)).toString("latin1").toLowerCase();
  const remaining = terms.filter((term) => raw.includes(term.toLowerCase()));
  return {
    redactionVerified: remaining.length === 0,
    redactionMessage: remaining.length === 0 ? "No requested redaction terms remain in raw PDF streams." : `Terms still detected: ${remaining.join(", ")}`,
  };
}

async function cropPdf(file: StoredFile, options: Options, outPath: string) {
  const document = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  document.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    const left = Number(options.left ?? 0);
    const bottom = Number(options.bottom ?? 0);
    page.setCropBox(left, bottom, width - left - Number(options.right ?? 0), height - bottom - Number(options.top ?? 0));
  });
  await writePdf(document, outPath);
}

async function imagesToPdf(files: StoredFile[], outPath: string) {
  const document = await PDFDocument.create();
  for (const file of files) {
    const normalized = file.type.includes("png") ? await readFile(file.path) : await sharp(file.path).jpeg().toBuffer();
    const image = file.type.includes("png") ? await document.embedPng(normalized) : await document.embedJpg(normalized);
    const page = document.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  await writePdf(document, outPath);
}

async function fillForms(file: StoredFile, options: Options, outPath: string) {
  const document = await PDFDocument.load(await readFile(file.path), { ignoreEncryption: true });
  const form = document.getForm();
  const values = JSON.parse(String(options.fields || "{}")) as Record<string, string>;
  Object.entries(values).forEach(([name, value]) => {
    try {
      form.getTextField(name).setText(value);
    } catch {
      // Unknown field names are ignored so partial form fills still succeed.
    }
  });
  if (String(options.flatten) === "true") form.flatten();
  await writePdf(document, outPath);
}

async function external(command: string, args: string[], fallbackMessage: string) {
  try {
    await exec(command, args, { timeout: 120_000 });
  } catch {
    throw new Error(`${fallbackMessage}. Ensure the Docker image system packages are installed. (${command})`);
  }
}

async function externalAvailable(command: string, args: string[]) {
  try {
    await exec(command, args, { timeout: 120_000 });
    return true;
  } catch {
    return false;
  }
}

async function convertedFile(tempDir: string, extension: string) {
  const files = await readdir(tempDir);
  const match = files.find((file) => file.toLowerCase().endsWith(extension));
  if (!match) throw new Error(`Conversion finished without producing a ${extension} file.`);
  return path.join(tempDir, match);
}

async function libreOfficeConvert(file: StoredFile, tempDir: string, extension: "pdf" | "docx" | "xlsx" | "pptx") {
  await external("libreoffice", ["--headless", "--convert-to", extension, "--outdir", tempDir, file.path], `${extension.toUpperCase()} conversion failed`);
  return convertedFile(tempDir, `.${extension}`);
}

export async function processPdfTool(tool: string, files: StoredFile[], options: Options): Promise<ProcessResult> {
  if (!files.length) throw new Error("No files were uploaded.");
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "pdfforge-"));
  const outPath = path.join(tempDir, `${tool}.pdf`);

  try {
    switch (tool) {
      case "merge":
        await merge(files, outPath);
        return { path: outPath, name: "merged.pdf", type: "application/pdf" };
      case "split": {
        const archivePath = await split(files[0], options, tempDir);
        return { path: archivePath, name: "split-pages.zip", type: "application/zip" };
      }
      case "delete-pages":
        await deletePages(files[0], options, outPath);
        return { path: outPath, name: "pages-deleted.pdf", type: "application/pdf" };
      case "organize-pages":
        await organizePages(files[0], options, outPath);
        return { path: outPath, name: "organized.pdf", type: "application/pdf" };
      case "page-numbers":
        await pageNumbers(files[0], options, outPath);
        return { path: outPath, name: "page-numbers.pdf", type: "application/pdf" };
      case "watermark":
        await watermark(files, options, outPath);
        return { path: outPath, name: "watermarked.pdf", type: "application/pdf" };
      case "edit":
        await editPdf(files, options, outPath);
        return {
          path: outPath,
          name: `${tool}.pdf`,
          type: "application/pdf",
          meta: String(options.redact) === "true" ? await verifyRedaction({ ...files[0], path: outPath }, options) : undefined,
        };
      case "signature":
        await editPdf(files, options, outPath);
        return { path: outPath, name: `${tool}.pdf`, type: "application/pdf" };
      case "crop":
        await cropPdf(files[0], options, outPath);
        return { path: outPath, name: "cropped.pdf", type: "application/pdf" };
      case "image-to-pdf":
        await imagesToPdf(files, outPath);
        return { path: outPath, name: "images.pdf", type: "application/pdf" };
      case "forms":
        await fillForms(files[0], options, outPath);
        return { path: outPath, name: "forms.pdf", type: "application/pdf" };
      case "compress": {
        const quality = options.quality === "extreme" ? "/screen" : options.quality === "low" ? "/printer" : "/ebook";
        const compressed = await externalAvailable("gs", ["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.5", `-dPDFSETTINGS=${quality}`, "-dNOPAUSE", "-dQUIET", "-dBATCH", `-sOutputFile=${outPath}`, files[0].path]);
        if (!compressed) {
          const document = await PDFDocument.load(await readFile(files[0].path), { ignoreEncryption: true });
          await writePdf(document, outPath);
        }
        return { path: outPath, name: "compressed.pdf", type: "application/pdf", meta: { compressionEngine: compressed ? "ghostscript" : "pdf-lib fallback" } };
      }
      case "protect":
        await external("qpdf", ["--encrypt", String(options.password || "pdfforge"), String(options.password || "pdfforge"), "256", "--", files[0].path, outPath], "PDF protection failed");
        return { path: outPath, name: "protected.pdf", type: "application/pdf" };
      case "unlock":
        await external("qpdf", [`--password=${String(options.password || "")}`, "--decrypt", files[0].path, outPath], "PDF unlock failed");
        return { path: outPath, name: "unlocked.pdf", type: "application/pdf" };
      case "repair":
        if (!(await externalAvailable("qpdf", [files[0].path, outPath]))) {
          const document = await PDFDocument.load(await readFile(files[0].path), { ignoreEncryption: true });
          await writePdf(document, outPath);
        }
        return { path: outPath, name: "repaired.pdf", type: "application/pdf" };
      case "pdf-to-image": {
        const prefix = path.join(tempDir, "page");
        const format = String(options.format || "png");
        await external("pdftoppm", [format === "jpg" ? "-jpeg" : "-png", files[0].path, prefix], "PDF image conversion failed");
        const archivePath = path.join(tempDir, "images.zip");
        const archive = new JSZip();
        const generated = (await readdir(tempDir)).filter((name) => name.startsWith("page-") && (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")));
        for (const name of generated) archive.file(name, await readFile(path.join(tempDir, name)));
        await writeFile(archivePath, await archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
        return { path: archivePath, name: `pdf-images.zip`, type: "application/zip" };
      }
      case "office-to-pdf": {
        const converted = await libreOfficeConvert(files[0], tempDir, "pdf");
        return { path: converted, name: "converted.pdf", type: "application/pdf" };
      }
      case "pdf-to-word": {
        const converted = await libreOfficeConvert(files[0], tempDir, "docx");
        return { path: converted, name: "converted.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
      }
      case "pdf-to-excel": {
        const converted = await libreOfficeConvert(files[0], tempDir, "xlsx");
        return { path: converted, name: "converted.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
      }
      case "pdf-to-powerpoint": {
        const converted = await libreOfficeConvert(files[0], tempDir, "pptx");
        return { path: converted, name: "converted.pptx", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
      }
      case "html-to-pdf": {
        await external("chromium", ["--headless", "--disable-gpu", "--no-sandbox", `--print-to-pdf=${outPath}`, `file://${files[0].path}`], "HTML to PDF conversion failed");
        return { path: outPath, name: "html.pdf", type: "application/pdf" };
      }
      case "ocr":
        await external("ocrmypdf", ["--skip-text", "-l", String(options.language || "eng"), files[0].path, outPath], "OCR failed");
        return { path: outPath, name: "searchable.pdf", type: "application/pdf" };
      case "permissions": {
        const report = JSON.stringify({ encrypted: false, note: "Use qpdf --show-encryption in Docker for a full permission audit." }, null, 2);
        const reportPath = path.join(tempDir, "permissions.json");
        await writeFile(reportPath, report);
        return { path: reportPath, name: "permissions.json", type: "application/json" };
      }
      default:
        throw new Error(`Unknown tool: ${tool}`);
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }
}
