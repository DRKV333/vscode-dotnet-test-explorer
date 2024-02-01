import * as vscode from "vscode";
import { Logger } from "./logger";
import { TestNode } from "./testNode";
import { Utility } from "./utility";

export class GotoTest {
    private async doGetLocation(test: TestNode): Promise<vscode.Location> {
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
            "vscode.executeWorkspaceSymbolProvider",
            test.fqn,
        );

        return this.findTestLocation(symbols, test).location;
    }

    public async info(test: TestNode): Promise<vscode.Location | null> {
        try {
            return await this.doGetLocation(test);
        } catch (r) {
            Logger.Log(r.message);
        }
        
        return null;
    }

    public async go(test: TestNode): Promise<void> {
        try {
            const location = await this.doGetLocation(test);

            vscode.workspace.openTextDocument(location.uri).then((doc) => {
                vscode.window.showTextDocument(doc).then((editor) => {
                    const loc = location.range;
                    const selection = new vscode.Selection(loc.start.line, loc.start.character, loc.start.line, loc.end.character);
                    vscode.window.activeTextEditor.selection = selection;
                    vscode.window.activeTextEditor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
                });
            });
        } catch (r) {
            Logger.Log(r.message);
            vscode.window.showWarningMessage(r.message);
        }
    }

    public findTestLocation(symbols: vscode.SymbolInformation[], testNode: TestNode): vscode.SymbolInformation {
        if (symbols.length === 0) {
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
}
