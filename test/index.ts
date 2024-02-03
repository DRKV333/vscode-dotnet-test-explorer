import * as path from 'path';
import * as Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		ui: 'tdd',
		color: true
	});

	const testsRoot = path.resolve(__dirname, '..');

	console.log(testsRoot);
	const files = await glob('**/**.test.js', { cwd: testsRoot });
	console.log(files.length);
	console.log(`please print this: ${files.length}`);

	// Add files to the test suite
	files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
	mocha.files.forEach(f => console.log(f));

	// Run the mocha test
	await new Promise<void>((resolve, reject) => {
		mocha.run(failures => {
			if (failures > 0)
				reject(new Error(`${failures} tests failed.`));
			else
				resolve();
		});
	});
}
