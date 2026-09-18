const { PDFDocument } = PDFLib;

const MAX_FILES = 30;
const MAX_TOTAL_BYTES = 500 * 1024 * 1024;

const state = {
  files: [],
  mergedBlob: null,
  totalPages: 0,
  draggingId: null,
};

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const selectFilesBtn = document.getElementById("selectFilesBtn");
const addMoreBtn = document.getElementById("addMoreBtn");
const fileList = document.getElementById("fileList");
const filesSection = document.getElementById("filesSection");
const statusArea = document.getElementById("statusArea");
const fileSummary = document.getElementById("fileSummary");
const mergeBtn = document.getElementById("mergeBtn");
const clearBtn = document.getElementById("clearBtn");
const resultSection = document.getElementById("resultSection");
const resultSummary = document.getElementById("resultSummary");
const downloadBtn = document.getElementById("downloadBtn");
const newMergeBtn = document.getElementById("newMergeBtn");

function bytesToSize(bytes) {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function createId(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showStatus(message, type = "info") {
  statusArea.innerHTML = "";
  if (!message) return;

  const el = document.createElement("div");
  el.className = `status-message ${type === "error" ? "error" : ""}`;
  el.textContent = message;
  statusArea.appendChild(el);
}

function totalSelectedBytes() {
  return state.files.reduce((sum, item) => sum + item.file.size, 0);
}

function updateSummary() {
  const totalBytes = totalSelectedBytes();
  fileSummary.textContent = `${state.files.length} arquivo(s) • ${bytesToSize(totalBytes)}`;
}

function validateIncomingFiles(files) {
  const pdfs = [...files].filter(
    (file) =>
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
  );

  if (pdfs.length !== files.length) {
    showStatus("Alguns arquivos foram ignorados porque não são PDFs.", "error");
  }

  if (state.files.length + pdfs.length > MAX_FILES) {
    throw new Error(`O limite desta versão é de ${MAX_FILES} arquivos por união.`);
  }

  const incomingBytes = pdfs.reduce((sum, file) => sum + file.size, 0);

  if (totalSelectedBytes() + incomingBytes > MAX_TOTAL_BYTES) {
    throw new Error(
      `O limite total desta versão é de ${bytesToSize(MAX_TOTAL_BYTES)}.`
    );
  }

  return pdfs;
}

async function readPdfMetadata(file) {
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
  });

  return {
    pageCount: pdf.getPageCount(),
  };
}

async function addFiles(fileListLike) {
  try {
    const validFiles = validateIncomingFiles([...fileListLike]);

    if (!validFiles.length) return;

    showStatus("Lendo os arquivos...");
    mergeBtn.disabled = true;

    for (const file of validFiles) {
      try {
        const metadata = await readPdfMetadata(file);

        state.files.push({
          id: createId(file),
          file,
          pageCount: metadata.pageCount,
        });
      } catch (error) {
        console.error(error);
        showStatus(
          `Não foi possível abrir "${file.name}". Ele pode estar protegido por senha, corrompido ou usar um recurso não suportado.`,
          "error"
        );
      }
    }

    renderFiles();

    if (state.files.length) {
      showStatus("");
    }
  } catch (error) {
    showStatus(error.message || "Não foi possível adicionar os arquivos.", "error");
  } finally {
    mergeBtn.disabled = state.files.length < 1;
    fileInput.value = "";
  }
}

function renderFiles() {
  fileList.innerHTML = "";

  state.files.forEach((item) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.draggable = true;
    li.dataset.id = item.id;

    li.innerHTML = `
      <span class="drag-handle" title="Arrastar para reordenar">☰</span>
      <div>
        <div class="file-name" title="${escapeHtml(item.file.name)}">
          ${escapeHtml(item.file.name)}
        </div>
        <div class="file-meta">
          ${item.pageCount} página(s) • ${bytesToSize(item.file.size)}
        </div>
      </div>
      <button class="remove-btn" type="button" aria-label="Remover ${escapeHtml(
        item.file.name
      )}">×</button>
    `;

    li.querySelector(".remove-btn").addEventListener("click", () => {
      removeFile(item.id);
    });

    li.addEventListener("dragstart", () => {
      state.draggingId = item.id;
      li.classList.add("dragging");
    });

    li.addEventListener("dragend", () => {
      state.draggingId = null;
      li.classList.remove("dragging");
    });

    li.addEventListener("dragover", (event) => {
      event.preventDefault();

      const draggingIndex = state.files.findIndex(
        (file) => file.id === state.draggingId
      );
      const targetIndex = state.files.findIndex((file) => file.id === item.id);

      if (
        draggingIndex === -1 ||
        targetIndex === -1 ||
        draggingIndex === targetIndex
      ) {
        return;
      }

      const [moved] = state.files.splice(draggingIndex, 1);
      state.files.splice(targetIndex, 0, moved);
      renderFiles();
    });

    fileList.appendChild(li);
  });

  const hasFiles = state.files.length > 0;
  filesSection.classList.toggle("hidden", !hasFiles);
  resultSection.classList.add("hidden");
  dropZone.classList.toggle("hidden", hasFiles);
  mergeBtn.disabled = !hasFiles;

  if (hasFiles) updateSummary();
}

function removeFile(id) {
  state.files = state.files.filter((item) => item.id !== id);
  resetMergedResult();
  renderFiles();
}

function clearAll() {
  state.files = [];
  resetMergedResult();
  showStatus("");
  renderFiles();
}

function resetMergedResult() {
  if (state.mergedBlob) {
    state.mergedBlob = null;
  }

  state.totalPages = 0;
  resultSection.classList.add("hidden");
}

async function mergePdfs() {
  if (!state.files.length) return;

  mergeBtn.disabled = true;
  clearBtn.disabled = true;
  addMoreBtn.disabled = true;
  showStatus("Unindo os PDFs... Isso pode levar alguns segundos em arquivos grandes.");

  try {
    const mergedPdf = await PDFDocument.create();
    let totalPages = 0;

    for (const item of state.files) {
      const bytes = await item.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(bytes, {
        ignoreEncryption: false,
        updateMetadata: false,
      });

      const pageIndices = sourcePdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);

      copiedPages.forEach((page) => mergedPdf.addPage(page));
      totalPages += copiedPages.length;
    }

    const mergedBytes = await mergedPdf.save({
      useObjectStreams: true,
    });

    state.mergedBlob = new Blob([mergedBytes], {
      type: "application/pdf",
    });

    state.totalPages = totalPages;

    filesSection.classList.add("hidden");
    dropZone.classList.add("hidden");
    resultSection.classList.remove("hidden");

    resultSummary.textContent = `${totalPages} página(s) • ${
      state.files.length
    } arquivo(s) unido(s) • ${bytesToSize(state.mergedBlob.size)}`;

    showStatus("");
  } catch (error) {
    console.error(error);
    showStatus(
      "Não foi possível unir os PDFs. Verifique se algum arquivo está protegido por senha ou corrompido.",
      "error"
    );
  } finally {
    mergeBtn.disabled = false;
    clearBtn.disabled = false;
    addMoreBtn.disabled = false;
  }
}

function downloadMergedPdf() {
  if (!state.mergedBlob) return;

  const url = URL.createObjectURL(state.mergedBlob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "documento-unificado.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function startNewMerge() {
  clearAll();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

selectFilesBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  fileInput.click();
});

addMoreBtn.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
});

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer.files);
});

mergeBtn.addEventListener("click", mergePdfs);
clearBtn.addEventListener("click", clearAll);
downloadBtn.addEventListener("click", downloadMergedPdf);
newMergeBtn.addEventListener("click", startNewMerge);

renderFiles();
