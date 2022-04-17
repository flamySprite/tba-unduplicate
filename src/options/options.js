
function failureCallback(error) {
    console.error("Error (unreceive2-options)" + error);
}

async function saveOptions(e) {
  let new_opts = {
    do_exclusive_filtering: document.querySelector("#filter_sender_check").checked,
    allowed_sender_list: document.querySelector("#sender_field").value,
    allow_trashing: document.querySelector("#allow_trashing_check").checked,
    enable_exp_features: document.querySelector("#enable_exp_features").checked,
    disable_logging: document.querySelector("#disable_logging").checked
  }
  console.debug("  dbg: saving opts:");
  console.debug(new_opts);
  await messenger.storage.sync.set(new_opts);
  e.preventDefault();
}

async function restoreOptions() {
  let storedOpts = await messenger.storage.sync.get({
    do_exclusive_filtering: true,
    allowed_sender_list: "",
    allow_trashing: true,
    enable_exp_features: false,
    disable_logging: false
  });
  document.querySelector('#sender_field').value = storedOpts.allowed_sender_list;
  document.querySelector('#filter_sender_check').checked = storedOpts.do_exclusive_filtering;
  document.querySelector('#allow_trashing_check').checked = storedOpts.allow_trashing;
  document.querySelector('#enable_exp_features').checked = storedOpts.enable_exp_features;
  document.querySelector('#disable_logging').checked = storedOpts.disable_logging;
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector("form").addEventListener("submit", saveOptions);
