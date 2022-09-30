import {File} from '../src/files';
import {assert} from 'chai';
import {run} from "../src/run";
import {array} from "../src/array";
import {asyncReturned} from "../src/collections";

describe("run", function () {
    function script(name: string) {
        return new File('example-scripts/' + name, __dirname).absolutePath;
    }

    it('when running a command streams stdout', async () => {
        const command = script('working.sh');
        const result = await array(run({command}));
        assert.deepEqual(result.join(''), 'Hello\nWorld\n');
    });

    it('can use shell redirect to get stdout and stderr in correct order (exec 2>&1)', async () => {
        const command = script('shell-redirect.sh');
        const result = await array(run({command}));
        assert.deepEqual(result.join(''), 'stout\nstderr\n');
    });

    it('can capture exit code and stdout', async () => {
        const command = script('failing.sh');
        const result = await array(asyncReturned(run({command})));
        assert.deepEqual(result, [
            {yielded: 'This command returns an exit code of 1\n'},
            {returned: 1},
        ]);
    });

    it('without shell redirect stdout and stderr are buffered (so order is not perfectly preserved)', async () => {
        const command = script('no-redirect.sh');
        const result = await array(asyncReturned(run({command})));
        assert.deepEqual(result, [
            {yielded: 'one\nthree\n'},
            {yielded: 'two\nfour\n'},
            {returned: 1},
        ]);
    });

    it('throw on missing script', async () => {
        const command = script('missing.sh');
        try {
            await array(run({command}));
        } catch (e: any) {
            assert.deepEqual(e.code, 'ENOENT');
        }
    });
});