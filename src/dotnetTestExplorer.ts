import * as path from "path";
import * as vscode from "vscode";
import { TreeDataProvider, TreeItem } from "vscode";
import { buildTree, mergeSingleItemTrees } from "./buildTree";
import { parseTestName } from "./parseTestName";
import { StatusBar } from "./statusBar";
import { ITestRunContext, TestCommands } from "./testCommands";
import { IDiscoverTestsResult } from "./testDiscovery";
import { TestNode, TestNodeIcon } from "./testNode";
import { ITestResult, TestResult } from "./testResult";
import { Utility } from "./utility";

export class DotnetTestExplorer implements TreeDataProvider<TestNode> {
    public _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter<any>();
    public readonly onDidChangeTreeData: vscode.Event<any> = this._onDidChangeTreeData.event;

    private discoveredTests: string[] | null = null;
    private testResults: TestResult[] | null = null;
    private testNodes: TestNode[] = [];

    constructor(private context: vscode.ExtensionContext, private testCommands: TestCommands, private statusBar: StatusBar) {
        testCommands.onTestDiscoveryFinished(this.updateWithDiscoveredTests, this);
        testCommands.onTestDiscoveryStarted(this.updateWithDiscoveringTest, this);
        testCommands.onTestRun(this.updateTreeWithRunningTests, this);
        testCommands.onBuildFail(this.updateTreeWithNotRunTests, this);
        testCommands.onNewTestResults(this.addTestResults, this);
    }

    /**
     * @description
     * Refreshes the test explorer pane by running the
     * `dotnet test` command and requesting information about
     * discovered tests.
     * @summary
     * This method can cause the project to rebuild or try
     * to do a restore, so it can be very slow.
     */
    public async refreshTestExplorer() {
        await this.testCommands.discoverTests();
    }

    public getTreeItem(element: TestNode): TreeItem {
        // if (element.isError) {
        //     return new TreeItem(element.name);
        // }

        const treeItem = new TreeItem(
            element.name,
            element.isFolder
                ? Utility.defaultCollapsibleState
                : undefined
        );

        treeItem.iconPath = {
            dark: this.context.asAbsolutePath(
                path.join("resources", "dark", element.icon)
            ),
            light: this.context.asAbsolutePath(
                path.join("resources", "light", element.icon)
            )
        };

        treeItem.contextValue = element.isFolder ? "folder" : "test";

        if (!element.isFolder) {
            treeItem.command = {
                command: "dotnet-test-explorer.leftClickTest",
                title: "",
                arguments: [element],
            };
        }

        return treeItem;
    }

    public getChildren(element?: TestNode): TestNode[] | Thenable<TestNode[]> {
        if (element) {
            return element.children;
        }

        if (!this.discoveredTests) {
            const loadingNode = new TestNode("", "Discovering tests", this.testResults);
            loadingNode.setIcon(TestNodeIcon.Running);
            return [loadingNode];
        }

        if (this.discoveredTests.length === 0) {
            // Show the welcome message.
            return [];
        }

        const treeMode = Utility.getConfiguration().get<string>("treeMode");

        if (treeMode === "flat") {
            this.testNodes = this.discoveredTests.map((name) => {
                return new TestNode("", name, this.testResults);
            });
            return this.testNodes;
        }

        const parsedTestNames = this.discoveredTests.map(parseTestName);
        let tree = buildTree(parsedTestNames);

        if (treeMode === "merged") {
            tree = mergeSingleItemTrees(tree);
        }

        this.testNodes = [];
        const concreteRoot = TestNode.fromAbstractTree("", tree, this.testResults, this.testNodes);

        return concreteRoot.children;
    }

    // change to use settings
    private updateWithDiscoveringTest() {
        this.discoveredTests = null;
        this._onDidChangeTreeData.fire(null);
    }

    // change to use settings
    private updateWithDiscoveredTests(results: IDiscoverTestsResult[]) {
        this.testNodes = [];
        this.discoveredTests = results.flatMap((r) => r.testNames);
        this.statusBar.discovered(this.discoveredTests.length);
        this._onDidChangeTreeData.fire(null);
    }

    private updateTreeWithRunningTests(testRunContext: ITestRunContext) {
        const runningTests = this.getNodesMatchingTestRun(testRunContext);

        this.statusBar.testRunning(runningTests.length);

        runningTests.forEach((testNode: TestNode) => {
            testNode.setIcon(TestNodeIcon.Running);
            this._onDidChangeTreeData.fire(testNode);
        });
    }

    private updateTreeWithNotRunTests(testRunContext: ITestRunContext) {
        const runningTests = this.getNodesMatchingTestRun(testRunContext);

        runningTests.forEach((testNode: TestNode) => {
            testNode.setIcon(TestNodeIcon.TestNotRun);
            this._onDidChangeTreeData.fire(testNode);
        });
    }

    private getNodesMatchingTestRun(testRunContext: ITestRunContext) {
        const filter = testRunContext.isSingleTest ?
            ((testNode: TestNode) => testNode.fqn === testRunContext.testName)
            : ((testNode: TestNode) => testNode.fullName.startsWith(testRunContext.testName));

        return this.testNodes.filter((testNode: TestNode) => !testNode.isFolder && filter(testNode));
    }

    private addTestResults(results: ITestResult) {
        const fullNamesForTestResults = results.testResults.map((r) => r.fullName);

        if (results.clearPreviousTestResults) {
            this.discoveredTests = [...fullNamesForTestResults];
            this.testResults = null;
        } else {
            if (!this.discoveredTests)
                this.discoveredTests = [];

            const newTests = fullNamesForTestResults.filter((r) => this.discoveredTests!.indexOf(r) === -1);

            if (newTests.length > 0) {
                this.discoveredTests.push(...newTests);
            }
        }

        this.discoveredTests.sort();

        this.statusBar.discovered(this.discoveredTests.length);

        if (this.testResults) {
            results.testResults.forEach((newTestResult: TestResult) => {
                const indexOldTestResult = this.testResults!.findIndex((tr) => tr.fullName === newTestResult.fullName);

                if (indexOldTestResult < 0) {
                    this.testResults!.push(newTestResult);
                } else {
                    this.testResults![indexOldTestResult] = newTestResult;
                }
            });
        } else {
            this.testResults = results.testResults;
        }

        this.statusBar.testRun(results.testResults);

        this._onDidChangeTreeData.fire(null);
    }
}
