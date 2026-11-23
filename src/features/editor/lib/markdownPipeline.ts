import type { Options as ToJsxOptions } from 'hast-util-to-jsx-runtime';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { extractFrontmatter, type NormalizedFrontmatter } from '@/features/editor/lib/frontmatter';
import { parseWikilinkInner } from '@/shared/lib/wikilinks';

export type HastRoot = Parameters<
  typeof import('hast-util-to-jsx-runtime').toJsxRuntime
>[0];
export type HastComponents = ToJsxOptions['components'];

export interface HeadingItem {
  depth: number;
  text: string;
  slug: string;
}

interface GenericAstNode {
  type: string;
  tagName?: string;
  value?: string;
  depth?: number;
  children?: GenericAstNode[];
  properties?: Record<string, unknown>;
  data?: {
    hName?: string;
    hProperties?: Record<string, unknown>;
  };
}

const SKIP_WIKILINK_PARENTS = new Set([
  'code',
  'inlineCode',
  'link',
  'linkReference',
  'definition',
  'yaml',
]);

function transformTextWithWikilinks(value: string): GenericAstNode[] | null {
  const regex = /(!?)\[\[([^[\]\r\n]+)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const parts: GenericAstNode[] = [];

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: value.slice(lastIndex, match.index),
      });
    }

    const isEmbed = match[1] === '!';
    const parsed = parseWikilinkInner(match[2], isEmbed);
    const label = parsed.alias ?? (parsed.target || parsed.heading || match[2]);

    if (isEmbed) {
      parts.push({
        type: 'wikilinkEmbed',
        data: {
          hName: 'span',
          hProperties: {
            'data-wikilink-embed': parsed.target,
            'data-heading': parsed.heading ?? '',
            'data-alias': parsed.alias ?? '',
          },
        },
        children: [{ type: 'text', value: label }],
      });
    } else {
      parts.push({
        type: 'wikilink',
        data: {
          hName: 'a',
          hProperties: {
            href: parsed.heading
              ? `#${parsed.heading}`
              : `#wikilink-${parsed.target}`,
            'data-wikilink': parsed.target,
            'data-heading': parsed.heading ?? '',
            'data-alias': parsed.alias ?? '',
          },
        },
        children: [{ type: 'text', value: label }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return null;

  if (lastIndex < value.length) {
    parts.push({
      type: 'text',
      value: value.slice(lastIndex),
    });
  }

  return parts;
}

function remarkWikilinks() {
  function walk(node: GenericAstNode) {
    if (!node.children || SKIP_WIKILINK_PARENTS.has(node.type)) return;

    const nextChildren: GenericAstNode[] = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string') {
        const replacement = transformTextWithWikilinks(child.value);
        if (replacement) {
          nextChildren.push(...replacement);
          continue;
        }
      }
      walk(child);
      nextChildren.push(child);
    }
    node.children = nextChildren;
  }

  return (tree: GenericAstNode) => {
    walk(tree);
  };
}

const CALLOUT_REGEX =
  /^\[!([a-zA-Z0-9_-]+)\]([+-])?(?:[ \t]+([^\r\n]*))?(?:\r?\n([\s\S]*))?$/;

function formatDefaultCalloutTitle(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function remarkObsidianCallouts() {
  function walk(node: GenericAstNode) {
    if (!node.children) return;
    for (const child of node.children) {
      if (child.type === 'blockquote' && child.children?.length) {
        const firstPara = child.children[0];
        if (
          firstPara.type === 'paragraph' &&
          firstPara.children?.length &&
          firstPara.children[0].type === 'text' &&
          typeof firstPara.children[0].value === 'string'
        ) {
          const match = CALLOUT_REGEX.exec(firstPara.children[0].value);
          if (match) {
            const calloutType = match[1].toLowerCase();
            const foldSymbol = match[2];
            const customTitle = (match[3] ?? '').trim();
            const remainderText = match[4] ?? '';

            const foldMode =
              foldSymbol === '-'
                ? 'closed'
                : foldSymbol === '+'
                  ? 'open'
                  : 'none';

            child.data = {
              ...child.data,
              hName: 'blockquote',
              hProperties: {
                ...(child.data?.hProperties ?? {}),
                'data-callout': calloutType,
                'data-callout-title':
                  customTitle || formatDefaultCalloutTitle(calloutType),
                'data-callout-fold': foldMode,
              },
            };

            if (remainderText.trim().length > 0) {
              firstPara.children[0].value = remainderText;
            } else {
              // Remove empty [!type] line and any immediate break node
              firstPara.children.shift();
              const nextFirst: GenericAstNode | undefined = firstPara.children[0];
              if (nextFirst?.type === 'break') {
                firstPara.children.shift();
              }
              if (firstPara.children.length === 0) {
                child.children.shift();
              }
            }
          }
        }
      }
      walk(child);
    }
  }

  return (tree: GenericAstNode) => {
    walk(tree);
  };
}

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'data-wikilink',
      'data-heading',
      'data-alias',
      'dataWikilink',
      'dataHeading',
      'dataAlias',
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      'data-wikilink-embed',
      'data-heading',
      'data-alias',
      'dataWikilinkEmbed',
      'dataHeading',
      'dataAlias',
    ],
    blockquote: [
      ...(defaultSchema.attributes?.blockquote ?? []),
      'data-callout',
      'data-callout-title',
      'data-callout-fold',
      'dataCallout',
      'dataCalloutTitle',
      'dataCalloutFold',
    ],
    code: [...(defaultSchema.attributes?.code ?? []), 'className'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      ['type', 'checkbox'],
      'checked',
      'disabled',
      'data-task-index',
      'dataTaskIndex',
    ],
  },
};

function rehypeAnnotateTaskCheckboxes() {
  return (tree: GenericAstNode) => {
    let taskIndex = 0;

    function walk(node: GenericAstNode) {
      if (
        node.type === 'element' &&
        node.tagName === 'input' &&
        node.properties?.type === 'checkbox'
      ) {
        node.properties.dataTaskIndex = String(taskIndex);
        taskIndex += 1;
      }
      if (node.children) {
        for (const child of node.children) walk(child);
      }
    }

    walk(tree);
  };
}

function extractPlainText(node: GenericAstNode): string {
  if (node.type === 'text' && typeof node.value === 'string') {
    return node.value;
  }
  if (!node.children) return '';
  return node.children.map(extractPlainText).join('');
}

function collectHeadingsFromHast(root: GenericAstNode): HeadingItem[] {
  const headings: HeadingItem[] = [];
  const headingTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

  function walk(node: GenericAstNode) {
    if (
      node.type === 'element' &&
      node.tagName &&
      headingTags.has(node.tagName)
    ) {
      const depth = Number(node.tagName.slice(1));
      const text = extractPlainText(node).trim();
      const slug =
        typeof node.properties?.id === 'string' ? node.properties.id : '';
      if (text && slug) {
        headings.push({ depth, text, slug });
      }
    }
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }

  walk(root);
  return headings;
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ['yaml'])
  .use(remarkGfm)
  .use(remarkWikilinks)
  .use(remarkObsidianCallouts)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeSanitize, SANITIZE_SCHEMA as unknown as Parameters<typeof rehypeSanitize>[0])
  .use(rehypeAnnotateTaskCheckboxes);

export interface ParsedMarkdownDocument {
  frontmatter: NormalizedFrontmatter;
  headings: HeadingItem[];
  hast: HastRoot;
}

export function parseMarkdownToHast(
  markdown: string,
  filePath?: string,
): ParsedMarkdownDocument {
  const { frontmatter, body } = extractFrontmatter(markdown, filePath);
  const mdast = markdownProcessor.parse(body);
  const hast = markdownProcessor.runSync(mdast) as unknown as HastRoot;
  const headings = collectHeadingsFromHast(hast as unknown as GenericAstNode);

  return {
    frontmatter,
    headings,
    hast,
  };
}
