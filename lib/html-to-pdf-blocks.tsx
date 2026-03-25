import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  h2: { fontSize: 16, fontWeight: "bold", marginTop: 14, marginBottom: 6 },
  h3: { fontSize: 13, fontWeight: "bold", marginTop: 10, marginBottom: 4 },
  p: { fontSize: 10, lineHeight: 1.6, marginBottom: 8 },
  bold: { fontWeight: "bold" },
  italic: { fontStyle: "italic" },
  ul: { marginBottom: 8, paddingLeft: 12 },
  ol: { marginBottom: 8, paddingLeft: 12 },
  li: { fontSize: 10, lineHeight: 1.6, marginBottom: 3, flexDirection: "row" as const },
  liBullet: { width: 12, fontSize: 10 },
  liContent: { flex: 1, fontSize: 10, lineHeight: 1.6 },
});

interface ParsedNode {
  tag: string;
  attrs?: Record<string, string>;
  children: (ParsedNode | string)[];
}

function parseHTML(html: string): ParsedNode[] {
  const nodes: (ParsedNode | string)[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const tagStart = html.indexOf("<", cursor);
    if (tagStart === -1) {
      const text = html.slice(cursor).trim();
      if (text) nodes.push(decodeEntities(text));
      break;
    }

    if (tagStart > cursor) {
      const text = html.slice(cursor, tagStart);
      if (text.trim()) nodes.push(decodeEntities(text));
    }

    // Self-closing tags
    if (html.slice(tagStart, tagStart + 4) === "<br>" || html.slice(tagStart, tagStart + 5) === "<br/>" || html.slice(tagStart, tagStart + 6) === "<br />") {
      nodes.push({ tag: "br", children: [] });
      cursor = html.indexOf(">", tagStart) + 1;
      continue;
    }

    // Closing tag — skip
    if (html[tagStart + 1] === "/") {
      cursor = html.indexOf(">", tagStart) + 1;
      continue;
    }

    // Opening tag
    const tagEnd = html.indexOf(">", tagStart);
    if (tagEnd === -1) break;

    const tagContent = html.slice(tagStart + 1, tagEnd);
    const spaceIdx = tagContent.indexOf(" ");
    const tagName = (spaceIdx > -1 ? tagContent.slice(0, spaceIdx) : tagContent).toLowerCase();

    // Find matching close tag
    const closeTag = `</${tagName}>`;
    let closeIdx = html.indexOf(closeTag, tagEnd + 1);
    // Handle nested same tags
    let depth = 1;
    let searchFrom = tagEnd + 1;
    while (depth > 0 && searchFrom < html.length) {
      const nextOpen = html.indexOf(`<${tagName}`, searchFrom);
      const nextClose = html.indexOf(closeTag, searchFrom);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchFrom = nextOpen + tagName.length + 1;
      } else {
        depth--;
        if (depth === 0) {
          closeIdx = nextClose;
        }
        searchFrom = nextClose + closeTag.length;
      }
    }

    if (closeIdx === -1) {
      cursor = tagEnd + 1;
      continue;
    }

    const innerHtml = html.slice(tagEnd + 1, closeIdx);
    const children = parseHTML(innerHtml);
    nodes.push({ tag: tagName, children });
    cursor = closeIdx + closeTag.length;
  }

  return nodes as ParsedNode[];
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function renderInlineChildren(children: (ParsedNode | string)[]): React.ReactNode[] {
  return children.map((child, i) => {
    if (typeof child === "string") {
      return <Text key={i}>{child}</Text>;
    }
    if (child.tag === "strong" || child.tag === "b") {
      return <Text key={i} style={styles.bold}>{renderInlineChildren(child.children)}</Text>;
    }
    if (child.tag === "em" || child.tag === "i") {
      return <Text key={i} style={styles.italic}>{renderInlineChildren(child.children)}</Text>;
    }
    if (child.tag === "u") {
      return <Text key={i} style={{ textDecoration: "underline" as any }}>{renderInlineChildren(child.children)}</Text>;
    }
    if (child.tag === "br") {
      return <Text key={i}>{"\n"}</Text>;
    }
    // Fallback: render as text
    return <Text key={i}>{renderInlineChildren(child.children)}</Text>;
  });
}

function renderNodes(nodes: (ParsedNode | string)[]): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let olCounter = 0;

  nodes.forEach((node, i) => {
    if (typeof node === "string") {
      if (node.trim()) {
        elements.push(<Text key={i} style={styles.p}>{node}</Text>);
      }
      return;
    }

    switch (node.tag) {
      case "h1":
      case "h2":
        elements.push(<Text key={i} style={styles.h2}>{renderInlineChildren(node.children)}</Text>);
        break;
      case "h3":
        elements.push(<Text key={i} style={styles.h3}>{renderInlineChildren(node.children)}</Text>);
        break;
      case "p":
        elements.push(<Text key={i} style={styles.p}>{renderInlineChildren(node.children)}</Text>);
        break;
      case "ul":
        elements.push(
          <View key={i} style={styles.ul}>
            {node.children.filter((c): c is ParsedNode => typeof c !== "string" && c.tag === "li").map((li, j) => (
              <View key={j} style={styles.li}>
                <Text style={styles.liBullet}>{"•  "}</Text>
                <Text style={styles.liContent}>{renderInlineChildren(li.children)}</Text>
              </View>
            ))}
          </View>
        );
        break;
      case "ol":
        olCounter = 0;
        elements.push(
          <View key={i} style={styles.ol}>
            {node.children.filter((c): c is ParsedNode => typeof c !== "string" && c.tag === "li").map((li, j) => {
              olCounter++;
              return (
                <View key={j} style={styles.li}>
                  <Text style={styles.liBullet}>{`${olCounter}.`}</Text>
                  <Text style={styles.liContent}>{renderInlineChildren(li.children)}</Text>
                </View>
              );
            })}
          </View>
        );
        break;
      case "br":
        elements.push(<Text key={i}>{"\n"}</Text>);
        break;
      default:
        // Block-level fallback
        elements.push(<Text key={i} style={styles.p}>{renderInlineChildren(node.children)}</Text>);
        break;
    }
  });

  return elements;
}

export function htmlToPdfElements(html: string): React.ReactNode[] {
  if (!html || html.trim() === "" || html === "<p></p>") return [];
  const nodes = parseHTML(html);
  return renderNodes(nodes);
}
