

function import_via_script (path) {
    const script = document.createElement('script');
    script.src = path;
    document.head.append(script);
    return script;
}

function funcIsAsync (func) {
    return (func.constructor.name == "AsyncFunction");
}

function funcUsesMultipleArgs (func) {
    if (func.length != undefined) {
        return (func.length > 1); 
    }
    console.error("function "+ func.name + " doesn't want to play along >:(");
    return undefined;
}
function do_test (func, input, expected_result, enforceMultipleParams=false) {
    let actual_result = undefined;
    if (enforceMultipleParams || funcUsesMultipleArgs(func)) {
        input = JSON.parse(input);
        actual_result = func(...input);
    }
    else {
        actual_result = func.apply(this, [input,]);
    }
    if (! objectEquals(expected_result, actual_result)) {
        console.error(func.name+": expected "+ JSON.stringify(expected_result) + " got instead "+ JSON.stringify(actual_result) + " for input "+ JSON.stringify(input) +"!");
        return false;
    }
    //console.debug(func.name+": result good! Got "+ JSON.stringify(actual_result) +", which is expected (=="+ JSON.stringify(expected_result) +") for input "+ JSON.stringify(input) +"!")
    return true;
}
function do_multiple_tests (func, tests, enforceMultipleParams=false) {
    let result = true;
    for ( let test_arg in tests ) {
        result = result & do_test(func, test_arg, tests[test_arg], enforceMultipleParams);
    }
    return result == 1
}


// SYNCHRONOUS TESTS

function test_getSpikeBracketInds () {
    let tests = {
        "hello <some@address.de>": {open: 6, close: 22},
        "no brackets": false,
        "a<>": {open:1, close:2},
        "<<>": {open:1, close:2},
        "<>>": {open:0, close:2},
        "><": false,
        "><>": {open:1, close:2}
    }
    return do_multiple_tests(getSpikeBracketInds, tests);
}
function test_extractAddressFromString () {
    let tests = {
        "hello <some@address.de>": "some@address.de",
        "just@the.address": "just@the.address",
        "": "",
        "well": "well"
        
    }
    return do_multiple_tests(extractAddressFromString, tests);
}
function test_getBoundaryIdentifier () {
    let tests = {
        'boundary="this-is-the-boundary"': 'boundary="this-is-the-boundary"',
        'blaaaboundary="here"blobb': 'boundary="here"',
        "": null,
        "well": null
        
    }
    return do_multiple_tests(getBoundaryIdentifier, tests);
}
function test_replaceAll () {
    let tests = {
        '["Hello","l","1"]': 'He11o',
        '["Hello", "el", "el"]': 'Hello',
        '["Hello", "xx", "blobb"]': 'Hello' 
    }
    return do_multiple_tests(replaceAll, tests)
}
function test_getAllBoundaryIdentifiers () {
    let tests = {
        'boundary="this-is-the-boundary"': ['boundary="this-is-the-boundary"'],
        'blaaaboundary="here"blobb': ['boundary="here"'],
        "": [],
        "well": [],
        'oneboundary="comes"\nseldomlyboundary="alone",right?': ['boundary="comes"', 'boundary="alone"']
        
    }
    return do_multiple_tests(getAllBoundaryIdentifiers, tests);
}
function test_getNormedMsgAndIdentifier () {
    let tests = {
        '["thisisb=12andb=21andb=42ok", ["b=12", "b=21", "b=42"]]': ['thisisb=12andb=12andb=12ok', "b=12"],
        '["message", []]': ["message", null],
        '["", ["b=34"]]': ["", "b=34"]
    }
    return do_multiple_tests(getNormedMsgAndIdentifier, tests);
}
function test_normCandStr () {
    let tests = {
        '["blab=12 alsob=21andstuff", "b=42"]': 'blab=12 alsob=21andstuff',
        '["blaboundary=12 alsoboundary=21andstuff", "boundary=42"]': 'blaboundary=42 alsoboundary=42andstuff',
        '[null, null]': null
    }
    return do_multiple_tests(normCandStr, tests);
}
function test_isSenderAllowed () {
    let tests = {
        '["*", null]': true,
        '[[""], {\"author\":\"x@x.x\"}]': false,
        '[["some@one.com"], {\"author\":\"some@one.com\"}]': true,
        '[["jj@y.y", "gg@y.y"], {\"author\":\"dd@y.y\"}]': false,
        '[["jj@y.y", "gg@y.y"], {\"author\":\"gg@y.y\"}]': true,
        '[["jj@y.y", "gg@y.y"], {\"author\":\"jj@y.y\"}]': true,
        '[["jj@y.y", "gg@y.y"], {\"author\":\"jJ@y.Y\"}]': true
    }
    return do_multiple_tests(isSenderAllowed, tests);
}
function test_shortenStr () {
    let tests = {
        '[""]': "",
        '["AAA"]': "AAA",
        '["AAAAA", 4]': "AAAA..."
    }
    return do_multiple_tests(shortenStr, tests, true);
}

// ASYNCHR TESTS

async function do_test_async (func, input, expected_result) {
    let actual_result = undefined;
    if (funcUsesMultipleArgs(func)) {
        input = JSON.parse(input);
        actual_result = await func(...input);
    }
    else {
        actual_result = await func(input);
    }
    if (! objectEquals(expected_result, actual_result)) {
        console.error(func.name+": expected "+ JSON.stringify(expected_result) + " got instead "+ JSON.stringify(actual_result) + " for input "+ JSON.stringify(input) +"!");
        return false;
    }
    console.debug(func.name+": result good! Got "+ JSON.stringify(actual_result) +", which is expected (=="+ JSON.stringify(expected_result) +") for input "+ JSON.stringify(input) +"!")
    return true;
}

async function do_test_with_mocked_func (func, input, expected_output, mock_path, mock_func) {
    let patcher = new Patcher();
    console.debug("  sdbg: patching "+ mock_path +" for test "+ func.name);
    let window = patcher.patch(mock_path, mock_func);
    let output_result = await do_test_async(func, input, expected_output);
    window = patcher.unpatch(mock_path);
    console.debug("  sdbg: unpatched "+ mock_path +" for test "+ func.name);
    return output_result;
}

async function test_canTrash () {
    let mocker = new Mock();
    async function test_trashing_not_allowed () {
        let func_input = undefined;
        let mock_returns = {"allow_trashing": false};
        let expected_output = false;
        mocker.reset();
        let output_result = await do_test_with_mocked_func(canTrash, func_input, expected_output, "messenger.storage.sync.get", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [['allow_trashing']]);
        return (output_result & call_result) == 1;
    }
    async function test_trashing_allowed () {
        let func_input = undefined;
        let mock_returns = {"allow_trashing": true};
        let expected_output = true;
        mocker.reset();
        let output_result = await do_test_with_mocked_func(canTrash, func_input, expected_output, "messenger.storage.sync.get", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [['allow_trashing']]);
        return (output_result & call_result) == 1;
    }
    return (await test_trashing_not_allowed() & await test_trashing_allowed() ) == 1;
}
async function test_getAllowedAuthorsOption () {
    let mocker = new Mock();
    async function test_allAllowedWhenNotExclusiveFiltering () {
        let func_input = undefined;
        let mock_returns = {"do_exclusive_filtering": false, "allowed_sender_list": ""};
        let expected_output = "*";
        mocker.reset();
        let output_result = await do_test_with_mocked_func(getAllowedAuthorsOption, func_input, expected_output, "messenger.storage.sync.get", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [["allowed_sender_list", "do_exclusive_filtering"]]);
        return (output_result & call_result) == 1;
    }
    async function test_separatedSendersWhenExclusiveFiltering () {
        let func_input = undefined;
        let mock_returns = {"do_exclusive_filtering": true, "allowed_sender_list": "a@b.c, c@d.e,  e@g.h  ,  i@j.k      "};
        let expected_output = ["a@b.c", "c@d.e", "e@g.h", "i@j.k"];
        mocker.reset();
        let output_result = await do_test_with_mocked_func(getAllowedAuthorsOption, func_input, expected_output, "messenger.storage.sync.get", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [["allowed_sender_list", "do_exclusive_filtering"]]);
        return (output_result & call_result) == 1;
    }
    async function test_undefinedOptionListYieldsEmptyList () {
        let func_input = undefined;
        let mock_returns = {"do_exclusive_filtering": true, "allowed_sender_list": undefined};
        let expected_output = [""];
        mocker.reset();
        let output_result = await do_test_with_mocked_func(getAllowedAuthorsOption, func_input, expected_output, "messenger.storage.sync.get", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [["allowed_sender_list", "do_exclusive_filtering"]]);
        return (output_result & call_result) == 1;
    }
    return (await test_allAllowedWhenNotExclusiveFiltering() & await test_separatedSendersWhenExclusiveFiltering() & await test_undefinedOptionListYieldsEmptyList () ) == 1;
}

async function test_removeCandidatesWithDifferentBodies () {
    let mocker = new Mock();
    let example_main_msg = {parts: {body: "message boundary=\"12\" body blobb"}};
    async function test_emptyCandidatesReturnsEmptyArray () {
        let func_input = [[], example_main_msg];
        let expected_output = [];
        let mock_returns = {parts: ""};
        mocker.reset();
        let output_result = await do_test_with_mocked_func(removeCandidatesWithDifferentBodies, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, false, [[]]);
        return (output_result & call_result) == 1;
    }
    async function test_equalCandidatesReturnAll () {
        let func_input = [[{id:0},], example_main_msg];
        let expected_output = [{id:0}];
        let mock_returns = example_main_msg;
        mocker.reset();
        let output_result = await do_test_with_mocked_func(removeCandidatesWithDifferentBodies, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, true, [0]);
        return (output_result & call_result) == 1;
    }
    async function test_differentCandidatesReturnOnlyEquals () {
        let func_input = [[{id:0},{id:1},{id:3},], example_main_msg];
        let expected_output = [{id:1}];
        let some_other_msg = {parts: {body: "message boundary=\"13\" body author: snek message: bo-boop"}};
        let mock_func = mocker.fake_func((id) => {
            if (id == 1) {
                return example_main_msg;
            } else {
                return some_other_msg;
            }
        });
        mocker.reset();
        let output_result = await do_test_with_mocked_func(removeCandidatesWithDifferentBodies, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mock_func);
        let call_result = eval_mocking(mocker, true, [3]);  // TODO: mocker only saves last called arguments. Should store all calls
        return (output_result & call_result) == 1;
    }
    return (await test_emptyCandidatesReturnsEmptyArray() & await test_equalCandidatesReturnAll() & await test_differentCandidatesReturnOnlyEquals() ) == 1;
}

async function test_filterDuplicates () {
    let mocker = new Mock();
    let example_main_msg = {parts: {body: "message boundary=\"12\" body author: snoop message: bloop"}};
    let example_main_header = {id:5};
    async function test_sameIdReturnsEmptyCandidates () {
        let func_input = [new Array({id:5, folder: {type: "inbox"}}), example_main_header, example_main_msg];
        let expected_output = [];
        let mock_returns = {parts: ""};
        mocker.reset();
        let output_result = await do_test_with_mocked_func(filterDuplicates, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, false, [[]]);
        return (output_result & call_result) == 1;
    }
    async function test_candInTrashOrSentReturnsEmptyCandidates () {
        let func_input = [new Array({id:1, folder: {type: "trash"}},{id:2, folder: {type: "sent"}}), example_main_header, example_main_msg];
        let expected_output = [];
        let mock_returns = {parts: ""};
        mocker.reset();
        let output_result = await do_test_with_mocked_func(filterDuplicates, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mocker.spy_and_return(mock_returns));
        let call_result = eval_mocking(mocker, false, [[]]);
        return (output_result & call_result) == 1;
    }
    async function test_candInOtherFolderReturnsCandidateIfBodyEqual () {
        let func_input = [new Array({id: 5, folder: {type: "inbox"}},{id:1, folder: {type: "trash"}},{id:2, folder: {type: "sent"}},{id:3, folder: {type: "inbox"}}), example_main_header, example_main_msg];
        let expected_output = [{id:3, folder: {type: "inbox"}}];
        let some_other_msg = {parts: {body: "message boundary=\"13\" body author: snek message: bo-boop"}};
        let mock_func = mocker.fake_func((id) => {
            if (id == 3 || id == 5) {
                return example_main_msg;
            } else {
                return some_other_msg;
            }
        });
        mocker.reset();
        let output_result = await do_test_with_mocked_func(filterDuplicates, JSON.stringify(func_input), expected_output, "messenger.messages.getFull", mock_func);
        let call_result = eval_mocking(mocker, true, [3]);
        return (output_result & call_result) == 1;
    }
    return (await test_sameIdReturnsEmptyCandidates() & await test_candInTrashOrSentReturnsEmptyCandidates() & await test_candInOtherFolderReturnsCandidateIfBodyEqual()) == 1;
}



var all_sync_tests = [
    test_getSpikeBracketInds,
    test_extractAddressFromString,
    test_getBoundaryIdentifier,
    test_replaceAll,
    test_getAllBoundaryIdentifiers,
    test_getNormedMsgAndIdentifier,
    test_normCandStr,
    test_isSenderAllowed,
    test_shortenStr
]
var all_async_tests = [
    test_canTrash,
    test_getAllowedAuthorsOption,
    test_removeCandidatesWithDifferentBodies,
    test_filterDuplicates,
];

async function run_async_tests (test_set, results) {
    let promisses = {};
    for (let test of test_set) {
        results[test.name] = {result: undefined, finished: false};
        console.debug(" sdbg: running now "+ test.name + "...");
        promisses[test.name] = await test();
        console.debug(" sdbg: done with "+ test.name + "..?");
    }
    return promisses;
}

async function test_ALL () {
    function show_test_results(results) {
        let all_fine = true;
        console.log(results)
        console.log("--- TEST RESULTS ---");
        for (let test in results) {
            let label = "";
            if (results[test].result) { label="passed"; } else {
                label="failed";
                console.error(test +" failed! It's result is "+ results[test].result);
            }
            all_fine = all_fine & results[test].result;
            console.log(test + ": " + label);
        }
        if ( all_fine ) {
            console.log("-->All tests passed!!");
        } else {
            console.log("-->Some tests failed!");
        }
        return all_fine;
    }
    let results = {};
    for (let test of all_sync_tests) {
        results[test.name] = {result: test(), finished: true};
    }
    let promisses = await run_async_tests(all_async_tests, results);
    for (let test_name in promisses) {
        if (!results[test_name].finished) {
            console.debug(test_name +" didn't finish, yet. Calling await ");
            results[test_name].result = await promisses[test_name];
        }
    }
    show_test_results(results);
}

async function allLoaded () {
    if (document.readyState === "complete" || document.readyState === "loaded") {
        console.debug('(undup-tests) all imports done!');
    } else { console.error(document.readyState)}
    test_ALL();
}

function prepareImports () {
    import_via_script('/unduplicate.js');
    import_via_script('/tests/util.js');
    import_via_script('/tests/mocking.js');
}

//document.getElementById('run_all_tests').addEventListener("click", test_ALL);
//import_unduplicate();
document.addEventListener('DOMContentLoaded', prepareImports);
window.addEventListener("load", allLoaded);
