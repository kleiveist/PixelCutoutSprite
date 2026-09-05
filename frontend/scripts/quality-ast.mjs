import path from "node:path";
import process from "node:process";
import ts from "typescript";

const classes = [];
const functions = [];
const imports = [];

function location(source, node) {
  const start = source.getLineAndCharacterOfPosition(node.getStart(source));
  const end = source.getLineAndCharacterOfPosition(node.getEnd());
  return { line: start.line + 1, endLine: end.line + 1 };
}

function nodeName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isClassExpression(node) && ts.isVariableDeclaration(node.parent)) {
    return ts.isIdentifier(node.parent.name) ? node.parent.name.text : "anonymous";
  }
  return "anonymous";
}

function assignedName(node) {
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return null;
}

function analyze(file) {
  const absolute = path.resolve(file);
  const text = ts.sys.readFile(absolute);
  if (text === undefined) throw new Error(`Cannot read ${absolute}`);
  const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length > 0) {
    const message = ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, "\n");
    throw new Error(`${absolute}: ${message}`);
  }

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      imports.push({
        file: absolute,
        ...location(source, statement),
        specifier: statement.moduleSpecifier.text,
      });
    }
  }

  function visit(node, scope = []) {
    if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
      ts.forEachChild(node, (child) => visit(child, [...scope, node.name.text]));
      return;
    }
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = nodeName(node);
      const symbol = [...scope, name].join(".");
      classes.push({ file: absolute, symbol, ...location(source, node) });
      ts.forEachChild(node, (child) => visit(child, [...scope, name]));
      return;
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push({
        file: absolute,
        symbol: [...scope, node.name.text].join("."),
        ...location(source, node),
      });
    } else if (ts.isMethodDeclaration(node) && node.name) {
      const name =
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
          ? node.name.text
          : node.name.getText(source);
      functions.push({
        file: absolute,
        symbol: [...scope, name].join("."),
        ...location(source, node),
      });
    } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const name = assignedName(node);
      if (name)
        functions.push({
          file: absolute,
          symbol: [...scope, name].join("."),
          ...location(source, node),
        });
    }

    if (ts.isObjectLiteralExpression(node)) {
      const name = assignedName(node);
      ts.forEachChild(node, (child) => visit(child, name ? [...scope, name] : scope));
      return;
    }
    ts.forEachChild(node, (child) => visit(child, scope));
  }

  visit(source);
}

try {
  for (const file of process.argv.slice(2)) analyze(file);
  process.stdout.write(`${JSON.stringify({ classes, imports, functions })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
