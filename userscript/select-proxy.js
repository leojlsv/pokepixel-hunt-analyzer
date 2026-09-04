export function createSelectProxy({
  select,
  classPrefix,
  ariaLabel,
  fallbackLabel,
  getSelectedLabel,
  onChange = () => {},
  onOpen = () => {},
  focusAfterSelect = true
}) {
  const proxy = document.createElement("details");
  proxy.className = `${classPrefix}-proxy`;

  const summary = document.createElement("summary");
  summary.className = `${classPrefix}-summary`;
  summary.setAttribute("aria-label", ariaLabel);

  const menu = document.createElement("div");
  menu.className = `${classPrefix}-menu`;
  menu.setAttribute("role", "listbox");

  function sync() {
    const selected = [...select.options].find((option) => option.value === select.value);
    const label = getSelectedLabel?.() || selected?.textContent || fallbackLabel;
    if (summary.textContent !== label) summary.textContent = label;
  }

  function rebuild() {
    menu.replaceChildren();
    const appendOption = (option) => {
      if (option.disabled) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `${classPrefix}-option`;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(option.selected));
      button.textContent = option.textContent;
      button.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        proxy.open = false;
        onChange();
        sync();
        if (focusAfterSelect) summary.focus();
      });
      menu.appendChild(button);
    };
    for (const child of select.children) {
      if (child.tagName === "OPTGROUP") {
        const heading = document.createElement("span");
        heading.className = `${classPrefix}-group`;
        heading.textContent = child.label;
        menu.appendChild(heading);
        for (const option of child.querySelectorAll("option")) appendOption(option);
      } else if (child.tagName === "OPTION") {
        appendOption(child);
      }
    }
  }

  const handleToggle = () => {
    if (!proxy.open) return;
    onOpen(proxy);
    rebuild();
  };
  const handleChange = () => queueMicrotask(sync);

  function destroy() {
    proxy.removeEventListener("toggle", handleToggle);
    select.removeEventListener("change", handleChange);
  }

  proxy.append(select, summary, menu);
  proxy.addEventListener("toggle", handleToggle);
  select.addEventListener("change", handleChange);
  sync();

  return { proxy, summary, menu, sync, rebuild, destroy };
}
