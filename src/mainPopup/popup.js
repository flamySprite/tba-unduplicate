function openOptions() {
    browser.runtime.openOptionsPage();
}

document.getElementById('goto_button').addEventListener("click", openOptions);

// experimental feature, which crawls through past emails and treats them as "newly received" to fire unduplication checks
async function unduplicatePastMails () {
    let query_info = {
        fromDate: new Date(new Date() - 1000*60*60*24),
        toDate: new Date()
       };
    console.debug(" (undup-popup): query:");
    console.debug(query_info);
    let duplicate_candidates = await messenger.messages.query(query_info);
    console.debug(duplicate_candidates);
    for (let candidate of duplicate_candidates.messages) {
        //console.debug(" (undup-popup): attempting candidate");
        //console.log(candidate);
        await onNewMailReceivedCallback(candidate.folder, {id: null, messages: [candidate]});
    }
    console.debug(" (undup-popup): done messing with the past.")
}

function importAndReadyPastCorrection () {
    // hacky import way:
    const script = document.createElement('script')
    script.src = '../unduplicate.js'
    document.head.append(script)  // this loads the whole script! And registers for events...

    document.getElementById('correct_past_button').addEventListener("click", unduplicatePastMails);
}

async function loadPopup () {
    let opts = await messenger.storage.sync.get(['enable_exp_features']);
    if (opts.enable_exp_features == true) {
        document.getElementById('correct_past_button').hidden = false;
        importAndReadyPastCorrection();
    }
    else {
        document.getElementById('correct_past_button').hidden = true;
    }
}

document.addEventListener("DOMContentLoaded", loadPopup);
