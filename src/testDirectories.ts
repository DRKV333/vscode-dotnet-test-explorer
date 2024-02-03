import * as fs from "fs";
import { glob } from "glob";
import * as path from "path";
import * as vscode from "vscode";
import { Logger } from "./logger";
import { Utility } from "./utility";

export interface TestForDirectory {
    dir: string,
    name: string
}

export class TestDirectories {
    private directories: string[] = [];
    private testsForDirectory: TestForDirectory[] = [];

    public async parseTestDirectories() {
        if (!(vscode.workspace?.workspaceFolders)) {
            return;
        }

        const testDirectoryGlob = Utility.getConfiguration().get<string>("testProjectPath");

        const matchingDirs: string[] = [];

        await Promise.all(vscode.workspace.workspaceFolders.map(async (folder) => {
            const globPattern = `${folder.uri.fsPath}/${testDirectoryGlob}`;

            Logger.Log(`Finding projects for pattern ${globPattern}`);

            const matchingDirsForWorkspaceFolder = await glob(globPattern, { windowsPathsNoEscape: true });

            matchingDirs.push(...matchingDirsForWorkspaceFolder);

            Logger.Log(`Found ${matchingDirsForWorkspaceFolder.length} matches for pattern in folder ${folder.uri.fsPath}`);
        }));

        this.directories = await evaluateTestDirectories(matchingDirs);
    }

    public addTestsForDirectory(testsForDirectory: TestForDirectory[]) {
        this.testsForDirectory = this.testsForDirectory.concat(testsForDirectory);
    }

    public clearTestsForDirectory() {
        this.testsForDirectory = [];
    }

    public getFirstTestForDirectory(directory: string): string | undefined {
        return this.testsForDirectory.find(
            (t) => t.dir === directory
        )?.name;
    }

    public getTestDirectories(testName?: string): string[] {
        if (testName && testName !== "") {
            const dirForTestName = this
                .testsForDirectory
                .filter((t) => t.name.startsWith(testName))
                .map((t) => t.dir);

            return [...new Set(dirForTestName)];
        }

        return this.directories;
    }
}

async function evaluateTestDirectories(testDirectories: string[]): Promise<string[]> {
    const directories = [];
    const directoriesSet = new Set<string>();

    for (let testProjectFullPath of testDirectories) {
        Logger.Log(`Evaluating match ${testProjectFullPath}`);

        if (!fs.existsSync(testProjectFullPath)) {
            Logger.LogWarning(`Path ${testProjectFullPath} is not valid`);
        } else {
            if (fs.lstatSync(testProjectFullPath).isFile()) {
                testProjectFullPath = path.dirname(testProjectFullPath);
            }

            if ((await glob(`${testProjectFullPath}/+(*.csproj|*.sln|*.fsproj)`, { windowsPathsNoEscape: true })).length < 1) {
                Logger.LogWarning(`Skipping path ${testProjectFullPath} since it does not contain something we can build (.sln, .csproj, .fsproj)`);
            } else if (!directoriesSet.has(testProjectFullPath)) {
                Logger.Log(`Adding directory ${testProjectFullPath}`);
                directories.push(testProjectFullPath);
                directoriesSet.add(testProjectFullPath);
            }
        }
    }

    return directories;
}
