import * as vscode from "vscode";
import { TestCommands } from "./testCommands";
import { ITestResult, TestResult } from "./testResult";
import { Utility } from "./utility";

interface ProblemInfo {
    uri: string,
    lineNumber: number,
    message: string
}

export class Problems {
    public static createProblemsFromResults(results: TestResult[]): Record<string, vscode.Diagnostic[]> {
        const resultsWithStackTrace = results
            .filter( (tr) => tr.stackTrace);

        if (!resultsWithStackTrace.length) {
            return {};
        }

        const problems: ProblemInfo[] = [];

        resultsWithStackTrace.forEach((testResult) => {
            let m = Problems.regex.exec(testResult.stackTrace);

            const resultsWithLinks: ProblemInfo[] = [];

            while (m !== null) {
                if (m.index === Problems.regex.lastIndex) {
                    Problems.regex.lastIndex++;
                }

                resultsWithLinks.push({uri: m[1], lineNumber: parseInt(m[2], 10), message: testResult.message});
                m = Problems.regex.exec(testResult.stackTrace);
            }

            problems.push(resultsWithLinks[resultsWithLinks.length - 1]);
        });

        return problems.reduce<Record<string, vscode.Diagnostic[]>>((groups, item) => {
            const val = item.uri;
            groups[val] = groups[val] || [];
            groups[val].push(new vscode.Diagnostic(new vscode.Range(item.lineNumber - 1, 0, item.lineNumber - 1, 10000), item.message));
            return groups;
        }, {});
    }

    private static regex = /in (.*):line (.*)/gm;
    private _diagnosticCollection?: vscode.DiagnosticCollection;

    constructor(testCommands: TestCommands) {
        if (Utility.getConfiguration().get<boolean>("addProblems")) {
            this._diagnosticCollection = vscode.languages.createDiagnosticCollection("dotnet-test-explorer");
            testCommands.onNewTestResults(this.addTestResults, this);
        }
    }

    public dispose() {
        if (this._diagnosticCollection) {
            this._diagnosticCollection.dispose();
        }
    }

    private addTestResults(results: ITestResult) {
        this._diagnosticCollection!.clear();

        const problems = Problems.createProblemsFromResults(results.testResults);

        const newDiagnostics: [vscode.Uri, vscode.Diagnostic[]][] = [];

        for (const problem in problems) {
            if (problems.hasOwnProperty(problem)) {
                newDiagnostics.push([vscode.Uri.file(problem), problems[problem]]);
            }
        }

        this._diagnosticCollection!.set(newDiagnostics);
    }
}
