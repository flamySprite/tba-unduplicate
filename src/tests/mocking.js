

function import_via_script (path) {
    const script = document.createElement('script');
    script.src = path;
    document.head.append(script);
    return script;
}
import_via_script('/tests/util.js');

function get_ref2function (path) {
    var cur_ref = window;
    for (let key of path.split('.')) {
        cur_ref = cur_ref[key];
    }
    return cur_ref;
}
function set_ref2function (path, new_func) {
    let cur_ref = window;
    let keys = path.split('.');
    for (let i in keys) {
        if ( i >= keys.length -1) {break;}
        cur_ref = cur_ref[keys[i]];
    }
    cur_ref[keys[keys.length-1]] = new_func;
    return window;
}

class Patcher {
    constructor () {
        this.backup_references = {};
        this.window = window;
    }
    
    patch (path, with_func) {
        this.backup_references[path] = get_ref2function(path);
        this.window = set_ref2function(path, with_func);
        return this.window;
    }
    
    unpatch (path) {
        this.window = set_ref2function(path, this.backup_references[path]);
        return this.window;
    }
}

class Mock {
    mocked_func_called;
    mocked_func_args;
    constructor () {
        this.reset();
    }
    
    reset () {
        this.mocked_func_called = false;
        this.mocked_func_args = null;
    }
    
    fake_func (replacing_func) {
        let parent = this;
        let callback = this.store_param;
        async function mock_func () {
            let args = Array.from(arguments)
            let return_value = replacing_func(...arguments);
            console.debug("  dbg: (mock-func) Called with args: "+ JSON.stringify(args) +" and returning "+ JSON.stringify(return_value));
            callback(parent, true, args);
            return return_value;
        }
        return mock_func;
    }
    
    spy_and_return (return_value) {
        this.cur_return_value = return_value;
        let dummy = () => {return return_value;}
        return (this.fake_func(dummy));
    }
    
    store_param (parent, called, args) {
        parent.mocked_func_called = called;
        parent.mocked_func_args = args;
    }
}


function eval_mocking ( mocker, is_mocked_func_expected_to_be_called, expected_call_args) {
    let call_result = (mocker.mocked_func_called == is_mocked_func_expected_to_be_called);
    let withCorrectArgsCalled = objectEquals(mocker.mocked_func_args, expected_call_args);
    if (!call_result) {
        let err_msg = "";
        if (is_mocked_func_expected_to_be_called) { err_msg="mocked function wasn't called, but supposed, too!";}
        else { err_msg="mocked function was called, but not supposed, too!";}
        console.error("eval_mocking: " + err_msg);
        return false;
    }
    if (mocker.mocked_func_called & ! withCorrectArgsCalled) {
        console.error("eval_mocking: mocked function was called with args " + JSON.stringify(mocker.mocked_func_args) + ", but expected where "+ JSON.stringify(expected_call_args) + "!");
        return false;
    }
    return true;
}
