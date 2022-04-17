
window.log = console.log;  // default fallback
function clog(msg) {
    window.log(msg);
}

// A wrapper function returning an async iterator for a MessageList. Derived from
// https://webextension-api.thunderbird.net/en/91/how-to/messageLists.html
async function* iterateMessagePages(page) {
    for (let message of page.messages) {
        yield message;
    }

    while (page.id) {
        page = await messenger.messages.continueList(page.id);
        for (let message of page.messages) {
            yield message;
        }
    }
}

function isSenderAllowed (allowed_authors, messageHeader) {
    if ( allowed_authors != '*' ) {
        let author_address = extractAddressFromString(messageHeader.author).toLowerCase();
        clog("  dbg: checking if '"+author_address+"' is fine");
        return allowed_authors.includes(author_address);
    }
    return true;
}
async function canTrash () {
    let opt_trashing = await messenger.storage.sync.get(['allow_trashing']);
    clog("  dbg: allowed to trash?");
    clog(opt_trashing);
    return (opt_trashing.allow_trashing == true);
}
async function handleDuplicationChecks (messageHeader) {
    let fullMessage = await messenger.messages.getFull(messageHeader.id);
    clog(fullMessage);
    let isDuplicate = await isDuplicateOfOtherMessages(messageHeader, fullMessage);
    if (isDuplicate == true) {
        if (await canTrash() == true) {
            clog(" info: ..is duplicate and will be moved now");
            messenger.messages.move([messageHeader.id,], await getTrashFolderForMessage(messageHeader));
        }
        else {
            clog("  info: ..is duplicate, but not allowed to trash (check addon options).");
        }
    } else { clog("  not duplicate");}
}
async function onNewMailReceivedCallback(folder, messages) {
    await determineLoggingFunction();
    clog(folder);
    // skip some folders like trash and sent
    if (folder.type == 'sent' || folder.type == 'trash') {
        clog(" dbg: ...ignored folder '"+folder.name+"'.");
        return;
    }
    // get allowed authors, if opted
    let allowed_authors = await getAllowedAuthorsOption();
    clog(allowed_authors);
    // ---
    for await (let messageHeader of iterateMessagePages(messages)) {
        clog(" info: new message:"); clog(messageHeader);
        if (isSenderAllowed(allowed_authors, messageHeader)) {
            handleDuplicationChecks(messageHeader);
        }
    }
    // debug
    clog("... dbg: done, on receiveCallback");
}

async function determineLoggingFunction () {
    let opts = await messenger.storage.sync.get(['disable_logging']);
    if ( opts.disable_logging == true ) {
        window.log = (msg) => {};
    }
    else {
        window.log = console.log;
    }
}

function awaitWithTimeout(timeout, ...args) { // https://stackoverflow.com/a/61220403
  function timeOut() {
    return new Promise((res, rej) => setTimeout(rej, timeout, new Error(`'awaitwithTimeout' timed out after ${timeout}ms`)));
  }
  return Promise.race([...args, timeOut()]);
}

async function getAllowedAuthorsOption () {
    let opt_allowed_authors = await messenger.storage.sync.get(['allowed_sender_list', 'do_exclusive_filtering']);
    clog("  dbg: opt author filtering?");
    clog(opt_allowed_authors);
    if ( opt_allowed_authors.do_exclusive_filtering == false ) {
        return "*";
    }
    else if ( typeof opt_allowed_authors.allowed_sender_list == 'undefined') {
        return [""];
    }
    return opt_allowed_authors.allowed_sender_list.split(",").map(s => s.trim().toLowerCase());
}

function extractAddressFromString (author_str) {
    let spikeBraks = getSpikeBracketInds(author_str);
    if (spikeBraks == false) return author_str;  // it works even without this line...
    return author_str.substring(spikeBraks.open+1, spikeBraks.close);
}
function getSpikeBracketInds (str) {
    let firstSpikeInd = str.lastIndexOf('<');
    let lastSpikeInd = str.lastIndexOf('>');
    if (firstSpikeInd != -1 & lastSpikeInd > firstSpikeInd) {
        return {open: firstSpikeInd, close: lastSpikeInd};
    }
    return false;
}

async function filterDuplicates (duplicate_candidates, messageHeader, fullMessage) {
    clog(" dbg: candidates: (before and after filtering)");
    clog(duplicate_candidates);
    duplicate_candidates = duplicate_candidates.filter(cand => cand.id != messageHeader.id);
    duplicate_candidates = duplicate_candidates.filter(cand => isMessageFromSentOrTrashFolder(cand) == false)
    duplicate_candidates = await removeCandidatesWithDifferentBodies(duplicate_candidates, fullMessage);
    clog(duplicate_candidates);
    return duplicate_candidates;
}
async function isDuplicateOfOtherMessages(messageHeader, fullMessage) {
    let query_info = {
        author: messageHeader.author, subject: messageHeader.subject,
        recipients: messageHeader.recipients.join(";"),
        fromDate: addMinutes(messageHeader.date, -30),
        toDate: addMinutes(messageHeader.date, 30)
       };
    clog("  dbg: query request is");
    clog(query_info);
    let duplicate_candidates = await awaitWithTimeout(10000, messenger.messages.query(query_info));
    return ((await filterDuplicates(duplicate_candidates.messages, messageHeader, fullMessage)).length >= 1);
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes*60000);
}

async function getTrashFolderForMessage(message) {
    let account = await messenger.accounts.get(message.folder.accountId);
    return account.folders.find(folder => folder.type == "trash");
}

function isMessageFromSentOrTrashFolder(message){
    return message.folder.type == 'sent' || message.folder.type == "trash";
}

async function removeCandidatesWithDifferentBodies(duplicate_candidates, full_message) {
    // need to find multipart messages and replace boundaries with sth generic in BOTH messages
    // known limitation: sending same message with exact same body, but altered attachment (same size and name, though) will be recongized as duplicate. Attachments are not compared for other than their name and size, yet.
    if (duplicate_candidates.length == 0 ) return [];
    let full_message_str = JSON.stringify(full_message.parts);
    let boundary_identifiers = getAllBoundaryIdentifiers(full_message_str);
    clog(" dbg: main message b identifiers (" + boundary_identifiers.length + ") are: " + boundary_identifiers);
    let [normed_msg, main_boundary_identifier] = getNormedMsgAndIdentifier(full_message_str, boundary_identifiers);
    clog(" dbg: cand bodies will be tested against str: " + shortenStr(normed_msg));
    let final_candidates = new Array();
    for (let i=0; i<duplicate_candidates.length; i++) {
        let cand_full = await messenger.messages.getFull(duplicate_candidates[i].id);
        let a = JSON.stringify(cand_full.parts);
        clog(" dbg: cand_str:"+shortenStr(a));
        let normed_cand_str = normCandStr(a, main_boundary_identifier);
        clog(" dbg: normed cand_str:"+shortenStr(normed_cand_str));
        clog(" dbg: cand_str equals recv_msg_str: " + (normed_cand_str == normed_msg));
        if (normed_cand_str == normed_msg) {
          final_candidates.push(duplicate_candidates[i]);
        }
    }
    return final_candidates;
}

function getAllBoundaryIdentifiers(stringified_parts) {
    let text = stringified_parts;
    const boundary_tag = "boundary=";
    let all_boundary_str = new Array();
    let position = text.search(boundary_tag);
    while (position != -1) {
        let new_boundary_str = getBoundaryIdentifier(text);
        if ( new_boundary_str == null ) break;
        if ( all_boundary_str.includes(new_boundary_str) == false ) {
            all_boundary_str.push(new_boundary_str);
        }
        text = text.slice(position+boundary_tag.length);
        position = text.search(boundary_tag);
    }
    return all_boundary_str;
}

function getBoundaryIdentifier(text) {
    const boundary_tag = "boundary=";
    let position = text.search(boundary_tag);
    if ( position === -1 ) return null;
    let pos_sec_quote = boundary_tag.length+2 + text.slice(
        position+boundary_tag.length+2,        // +2 for each '\"', 
        position+boundary_tag.length+69+4+1    // 69 for max. boundary length,
        ).search('"');                         // +1 to include last char
    if ( pos_sec_quote == -1 ) {
        console.warn("Unexpected (unreceive2-boundaryFinder): boundary was found, but no second quote-mark??");
        return null;
    }
    let boundary_str = text.slice(position,position+pos_sec_quote+1);
    return boundary_str;
}

function getNormedMsgAndIdentifier(full_message_str, boundary_identifiers) {
    let normed_msg = full_message_str;
    let boundary_identifier = null;
    if ( boundary_identifiers.length > 0 ) {
        boundary_identifier = boundary_identifiers[0];
        for ( let b_id of boundary_identifiers ) {
            normed_msg = replaceAll(normed_msg, b_id, boundary_identifier);
        }
    }
    return [normed_msg, boundary_identifier];
}

function shortenStr( str, max_length=40) {
    if (str.length > max_length) {
        return str.slice(0, max_length) + '...';
    }
    return str;
}

function replaceAll(text, search_str, replace_str) {
    if ( search_str == replace_str ) return text;
    let new_text = text;
    while ( new_text.includes(search_str) ) {
        new_text = new_text.replace(search_str, replace_str)
    }
    return new_text;
}

function normCandStr (a, b_identifier) {
    if ( b_identifier == null ) return a;
    let cand_boundaries = getAllBoundaryIdentifiers(a);
    clog(" dbg: cand b_ids: " + cand_boundaries);
    let normed_cand_str = a;
    for (let cand_b_id of cand_boundaries) {
        normed_cand_str = replaceAll(normed_cand_str, cand_b_id, b_identifier);
    }
    return normed_cand_str
}

async function load() {
    messenger.messages.onNewMailReceived.addListener(onNewMailReceivedCallback);
}

document.addEventListener("DOMContentLoaded", load);

