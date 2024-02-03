import * as fs from "fs";
import { DOMParser } from "@xmldom/xmldom";
import { TestResult } from "./testResult";

function findChildElement(node: Element, name: string): Element | null {
    let child = node.firstChild;
    while (child) {
        if (child.nodeName === name) {
            return child as Element;
        }

        child = child.nextSibling;
    }

    return null;
}

function getAttributeValue(node: Element, name: string): string | null {
    const attribute = node.attributes.getNamedItem(name);
    return (attribute === null) ? null : attribute.nodeValue;
}

function getTextContentForTag(parentNode: Element, tagName: string): string {
    const node = parentNode.getElementsByTagName(tagName);
    return node[0]?.textContent ?? "";
}

function parseDuration(value: string): number | undefined {
    const parts = value.split(':');
    if (parts.length !== 3)
        return undefined;

    let milliseconds = 0;

    // hours
    milliseconds = milliseconds + parseInt(parts[0], 10) * 60 * 60 * 1000;

    // minutes
    milliseconds = milliseconds + parseInt(parts[1], 10) * 60 * 1000;

    // seconds
    milliseconds = milliseconds + parseFloat(parts[2]) * 1000;

    return milliseconds;
}

function parseUnitTestResults(xml: Element): TestResult[] {
    const results: TestResult[] = [];
    const nodes = xml.getElementsByTagName("UnitTestResult");

    // TSLint wants to use for-of here, but nodes doesn't support it
    /* tslint:disable-next-line */
    for (let i = 0; i < nodes.length; i++) { // NOSONAR
        const testId = getAttributeValue(nodes[i], 'testId');
        if (!testId)
            continue;

        results.push(
            new TestResult(
                testId,
                getAttributeValue(nodes[i], 'outcome') ?? "",
                getTextContentForTag(nodes[i], 'Message'),
                getTextContentForTag(nodes[i], 'StackTrace'),
                parseDuration(getAttributeValue(nodes[i], 'duration') ?? ""),
                nodes[i].toString() // TODO: ???
            )
        )
    }

    return results;
}

function updateUnitTestDefinitions(xml: Element, results: TestResult[]): void {
    const nodes = xml.getElementsByTagName("UnitTest");
    const names = new Map<string, any>();

    /* tslint:disable-next-line */
    for (let i = 0; i < nodes.length; i++) { // NOSONAR
        const node = nodes[i];

        const id = getAttributeValue(node, "id");
        if (!id)
            continue;

        const testMethod = findChildElement(node, "TestMethod");
        if (!testMethod)
            continue;

        names.set(id, {
            className: getAttributeValue(testMethod, "className"),
            method: getAttributeValue(node, "name"),
        });
    }

    for (const result of results) {
        const name = names.get(result.id);
        if (name) {
            result.updateName(name.className, name.method);
        }
    }
}

export function parseResults(filePath: string): Promise<TestResult[]> {
    return new Promise((resolve, reject) => {
        let results: TestResult[];
        fs.readFile(filePath, (err, data) => {
            if (!err) {
                const xdoc = new DOMParser().parseFromString(data.toString(), "application/xml");
                results = parseUnitTestResults(xdoc.documentElement);

                updateUnitTestDefinitions(xdoc.documentElement, results);

                try {
                    fs.unlinkSync(filePath);
                } catch { }

                resolve(results);
            }
        });
    });
}
