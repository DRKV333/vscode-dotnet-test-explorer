import * as vscode from "vscode";
import { Logger } from "./logger";
import { TestNode } from "./testNode";
import { Utility } from "./utility";

export class GotoTest {
    private firstTry = true;

    private async doGetLocation(test: TestNode, retry: boolean): Promise<vscode.Location> {
        const attemptRetry = retry && this.firstTry;
        
        let symbols: vscode.SymbolInformation[] | null = null;
        let startTime = -1;
        let timeout = 0;

        while (true) {
            symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                "vscode.executeWorkspaceSymbolProvider",
                test.fqn,
            );

            if (symbols?.length > 0 || !attemptRetry)
                break;

            if (startTime == -1) {
                startTime = Date.now();
                timeout = Utility.getConfiguration().get<number>("startupSymbolPollingTimeout", 60) * 1000;
                if (timeout == 0)
                    break;
            }

            if (Date.now() - startTime > timeout)
                break;

            Logger.Log("Waiting for symbols to become available...");
            await this.sleep(1000);
        }

        if (attemptRetry || symbols?.length > 0)
            this.firstTry = false;

        if (attemptRetry && symbols?.length == 0)
            throw Error("Waited for .NET test symbols, but they did not become available.");

        return this.findTestLocation(symbols, test).location;
    }

    public async info(test: TestNode): Promise<vscode.Location | null> {
        try {
            return await this.doGetLocation(test, true);
        } catch (r: any) {
            Logger.Log(r.message);
        }
        
        return null;
    }

    public async go(test: TestNode): Promise<void> {
        try {
            const location = await this.doGetLocation(test, false);

            vscode.workspace.openTextDocument(location.uri).then((doc) => {
                vscode.window.showTextDocument(doc).then((editor) => {
                    if (vscode.window.activeTextEditor) {
                        const loc = location.range;
                        const selection = new vscode.Selection(loc.start.line, loc.start.character, loc.start.line, loc.end.character);
                        vscode.window.activeTextEditor.selection = selection;
                        vscode.window.activeTextEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                    }
                });
            });
        } catch (r: any) {
            Logger.Log(r.message);
            vscode.window.showWarningMessage(r.message);
        }
    }

    public findTestLocation(symbols: vscode.SymbolInformation[], testNode: TestNode): vscode.SymbolInformation {
        if (!symbols || symbols.length === 0) {
            throw new Error(`Could not find test ${testNode.name} (no symbols found)`);
        }

        const testFqn = testNode.fqn;

        symbols = symbols.filter((s) => this.isSymbolATestCandidate(s) && testFqn.endsWith(Utility.trimArguments(s.name)));

        if (symbols.length === 0) {
            throw Error(`Could not find test ${testNode.name} (no symbols matching)`);
        }

        if (symbols.length > 1) {
            throw Error(`Could not find test ${testNode.name} (found multiple matching symbols)`);
        }

        return symbols[0];
    }

    private fsharpSymbolKinds = [vscode.SymbolKind.Variable, vscode.SymbolKind.Field, vscode.SymbolKind.Method];

    private isSymbolATestCandidate(s: vscode.SymbolInformation): boolean {
        return s.location.uri.toString().endsWith(".fs") ? this.fsharpSymbolKinds.includes(s.kind) : s.kind === vscode.SymbolKind.Method;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        })
    }
}
