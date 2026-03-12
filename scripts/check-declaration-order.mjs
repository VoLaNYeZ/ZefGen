import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const IGNORE_DIRS = new Set([
    '.git',
    'build',
    'coverage',
    'dist',
    'docs',
    'node_modules',
]);

const SOURCE_EXT_RE = /\.[cm]?[jt]sx?$/i;

const isIgnoredPath = (fullPath) =>
    fullPath.split(path.sep).some((segment) => IGNORE_DIRS.has(segment));

const collectSourceFiles = (dir, out) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (isIgnoredPath(fullPath)) continue;
        if (entry.isDirectory()) {
            collectSourceFiles(fullPath, out);
            continue;
        }
        if (SOURCE_EXT_RE.test(entry.name)) out.push(fullPath);
    }
};

const isTypePosition = (node) => {
    for (let current = node; current; current = current.parent) {
        if (ts.isTypeNode(current)) return true;
        if (ts.isExpressionStatement(current) || ts.isVariableDeclaration(current) || ts.isReturnStatement(current)) break;
    }
    return false;
};

const walkImmediate = (node, visit) => {
    const recur = (current) => {
        if (!current) return;
        if (ts.isFunctionLike(current)) return;
        visit(current);
        ts.forEachChild(current, recur);
    };
    recur(node);
};

const collectBlockScopedDeclarations = (statements, sourceFile) => {
    const declarations = [];

    for (const statement of statements) {
        if (!ts.isVariableStatement(statement)) continue;
        if ((statement.declarationList.flags & ts.NodeFlags.BlockScoped) === 0) continue;

        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
            declarations.push({
                name: declaration.name.text,
                pos: declaration.name.getStart(sourceFile),
                line: sourceFile.getLineAndCharacterOfPosition(declaration.name.getStart(sourceFile)).line + 1,
                initializer: declaration.initializer,
            });
        }
    }

    return declarations;
};

const inspectStatements = (sourceFile, statements, problems) => {
    const declarations = collectBlockScopedDeclarations(statements, sourceFile);
    if (!declarations.length) return;

    const declarationByName = new Map(declarations.map((entry) => [entry.name, entry]));

    for (const declaration of declarations) {
        walkImmediate(declaration.initializer, (node) => {
            if (!ts.isIdentifier(node)) return;
            if (node.text === declaration.name) return;
            if (isTypePosition(node)) return;

            const parent = node.parent;
            if (ts.isPropertyAccessExpression(parent) && parent.name === node) return;
            if (ts.isPropertyAssignment(parent) && parent.name === node) return;
            if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) return;
            if (ts.isQualifiedName(parent) && parent.right === node) return;

            const referenced = declarationByName.get(node.text);
            if (!referenced) return;
            if (referenced.pos <= declaration.pos) return;
            if (node.getStart(sourceFile) === referenced.pos) return;

            problems.push({
                file: sourceFile.fileName,
                line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
                owner: declaration.name,
                referenced: referenced.name,
                referencedLine: referenced.line,
            });
        });
    }
};

const inspectFile = (filePath, problems) => {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const scriptKind = filePath.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : filePath.endsWith('.ts')
          ? ts.ScriptKind.TS
          : filePath.endsWith('.jsx')
            ? ts.ScriptKind.JSX
            : ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind);
    inspectStatements(sourceFile, sourceFile.statements, problems);

    const visit = (node) => {
        if (ts.isBlock(node)) {
            inspectStatements(sourceFile, node.statements, problems);
        }
        ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
};

const files = [];
collectSourceFiles(projectRoot, files);

const problems = [];
for (const filePath of files) {
    inspectFile(filePath, problems);
}

if (problems.length) {
    console.error('Declaration-order check failed.\n');
    for (const problem of problems) {
        const relativePath = path.relative(projectRoot, problem.file);
        console.error(
            `${relativePath}:${problem.line} \`${problem.owner}\` references later \`${problem.referenced}\` (declared at line ${problem.referencedLine})`
        );
    }
    process.exit(1);
}

console.log(`Declaration-order check passed for ${files.length} files.`);
