// Preserve native form controls while telemetry changes around them.
export function patchLivePanel(root, html) {
  if (!root) return;
  const template = root.ownerDocument.createElement("template");
  template.innerHTML = html;
  const key = (node) =>
    node.nodeType === 1
      ? node.id || node.querySelector("select[id], input[id]")?.id || null
      : null;
  const compatible = (a, b) =>
    a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);
  function children(current, incoming) {
    let cursor = current.firstChild;
    for (const next of [...incoming.childNodes]) {
      let match = cursor;
      if (!match || !compatible(match, next)) {
        match = [...current.childNodes].find(
          (node) =>
            key(next) && key(node) === key(next) && compatible(node, next),
        );
        if (match) current.insertBefore(match, cursor);
        else {
          match = next.cloneNode(true);
          current.insertBefore(match, cursor);
        }
      }
      if (match.nodeType === 3) {
        if (match.textContent !== next.textContent)
          match.textContent = next.textContent;
      } else if (match.nodeType === 1) {
        const focused = match === root.ownerDocument.activeElement;
        if (!focused) {
          for (const attr of [...match.attributes])
            if (!next.hasAttribute(attr.name) && attr.name !== "value")
              match.removeAttribute(attr.name);
          for (const attr of [...next.attributes])
            if (
              attr.name !== "value" &&
              match.getAttribute(attr.name) !== attr.value
            )
              match.setAttribute(attr.name, attr.value);
        }
        // Recreating options closes an open native menu. Amount fields retain edits.
        if (
          match.tagName !== "INPUT" &&
          !(match.tagName === "SELECT" && focused)
        )
          children(match, next);
        if (match.tagName === "SELECT" && !focused) match.value = next.value;
      }
      cursor = match.nextSibling;
    }
    while (cursor) {
      const remaining = cursor;
      cursor = cursor.nextSibling;
      remaining.remove();
    }
  }
  children(root, template.content);
}

export function editingControl(document) {
  return !!document.activeElement?.matches(
    "select, input, textarea, [contenteditable=true]",
  );
}
