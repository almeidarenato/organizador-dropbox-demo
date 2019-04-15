import { Dropbox } from "dropbox";

const dbx = new Dropbox({
  accessToken: "", //token do dropbox para acessar a API
  fetch
});

const fileListElement = document.querySelector(".js-file-list");
const loadingElement = document.querySelector(".js-loading");
const rootPathForm = document.querySelector(".js-root-path__form");
const rootPathInput = document.querySelector(".pesquisa-campo");
const organizeBtn = document.querySelector(".organizar-btn");

rootPathForm.addEventListener("submit", e => {
  e.preventDefault();
  state.rootPath =
    rootPathInput.value === "/" ? "" : rootPathInput.value.toLowerCase();
  reset();
});

organizeBtn.addEventListener("click", async e => {
  const originalMsg = e.target.innerHTML;
  e.target.disable = true;
  e.target.innerHTML = "Organizando...";
  await moveFilesToDatedFolders();
  e.target.disable = false;
  e.target.innerHTML = originalMsg;
  reset();
});

const reset = () => {
  state.files = [];
  loadingElement.classList.remove("hidden");
  init();
};

const state = {
  files: [],
  rootPath: ""
};
const init = async () => {
  const res = await dbx.filesListFolder({
    path: state.rootPath,
    limit: 20
  });
  updateFiles(res.entries);
  if (res.has_more) {
    loadingElem.classList.remove("hidden");
    await getMoreFiles(res.cursor, more => updateFiles(more.files));
    loadingElement.classList.add("hidden");
  } else {
    loadingElement.classList.add("hidden");
  }
};

const updateFiles = files => {
  state.files = [...state.files, ...files];
  renderFiles();
  getThumbnails(files);
};

const getMoreFiles = async (cursor, cb) => {
  const res = await dbx.filesListFolderContinue({ cursor });
  if (cb) cb(res);
  if (res.has_more) await getMoreFiles(res.cursor, cb);
};

const renderFiles = () => {
  fileListElement.innerHTML = state.files
    .sort((a, b) => {
      //ordena a lista em ordem alfabética com as pastas em primeiro - order the list in alphabetical order
      if (
        (a[".tag"] === "folder" || b[".tag"] === "folder") &&
        !(a[".tag"] === b[".tag"])
      ) {
        return a[".tag"] === "folder" ? -1 : 1;
      } else {
        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
      }
    })
    .map(file => {
      const type = file[".tag"];
      let thumbnail;
      if (type === "file") {
        thumbnail = file.thumbnail
          ? `data:image/jpeg;base64, ${file.thumbnail}`
          : `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWZpbGUiPjxwYXRoIGQ9Ik0xMyAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOXoiPjwvcGF0aD48cG9seWxpbmUgcG9pbnRzPSIxMyAyIDEzIDkgMjAgOSI+PC9wb2x5bGluZT48L3N2Zz4=`;
      } else {
        thumbnail = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0iZmVhdGhlciBmZWF0aGVyLWZpbGUiPjxwYXRoIGQ9Ik0xMyAySDZhMiAyIDAgMCAwLTIgMnYxNmEyIDIgMCAwIDAgMiAyaDEyYTIgMiAwIDAgMCAyLTJWOXoiPjwvcGF0aD48cG9seWxpbmUgcG9pbnRzPSIxMyAyIDEzIDkgMjAgOSI+PC9wb2x5bGluZT48L3N2Zz4=`;
      }
      return `<li class='dbx-list-item ${type}'><img class='dbx-thumb' src='${thumbnail}'>${
        file.name
      }</li>`;
    })
    .join("");
};
const getThumbnails = async files => {
  const paths = files
    .filter(file => file[".tag"] === "file")
    .map(file => ({
      path: file.path_lower,
      size: "w32h32"
    }));
  const res = await dbx.filesGetThumbnailBatch({
    entries: paths
  });
  //console.log(res);
  // copia os StateFiles
  const newStateFiles = [...state.files];
  //encontra qual arquivo precisa da thumbnail (só os arquivos com Thumbnail)
  res.entries.forEach(file => {
    let indexToUpdate = state.files.findIndex(
      stateFile => file.metadata.path_lower === stateFile.path_lower
    );

    newStateFiles[indexToUpdate].thumbnail = file.thumbnail;
  });
  state.files = newStateFiles;
  renderFiles();
};

const moveFilesToDatedFolders = async () => {
  const entries = state.files
    .filter(file => file[".tag"] === "file")
    .map(file => {
      const date = new Date(file.client_modified);
      return {
        from_path: file.path_lower,
        to_path: `${state.rootPath}/${date.getFullYear()}/${date.getUTCMonth() +
          1}/${file.name}`
      };
    });
  try {
    let res = await dbx.filesMoveBatchV2({ entries });
    const { async_job_id } = res;
    if (async_job_id) {
      do {
        res = await dbx.filesMoveBatchCheckV2({ async_job_id });
        console.log(res);
      } while (res[".tag"] === "in_progress");
    }
  } catch (err) {
    console.error(err);
  }
};
init();
