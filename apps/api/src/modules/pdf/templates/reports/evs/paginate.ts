// Executed inside Chromium after fonts/images load, so continuation pages use actual sizes.
export function paginateEvs() {
  // Keep the three header rows fixed even when the report number wraps.
  for (const cell of document.querySelectorAll<HTMLElement>('.evs-report-number')) {
    const text = cell.querySelector<HTMLElement>('span')!;
    let size = 15;
    text.style.fontSize = `${size}px`;
    while (size > 4 && text.getBoundingClientRect().height > cell.clientHeight - 6) {
      size -= 0.5;
      text.style.fontSize = `${size}px`;
    }
  }
  // Center the rendered content as one block. The stored drawing, point labels
  // and relative positions are unchanged; the grid stays aligned with the page.
  for (const content of document.querySelectorAll<SVGGElement>('[data-print-drawing-content]')) {
    const page = content.ownerSVGElement!.viewBox.baseVal;
    const bounds = content.getBBox();
    if (!content.children.length || (!bounds.width && !bounds.height)) continue;
    const scale = Math.min(
      1,
      page.width / Math.max(1, bounds.width),
      page.height / Math.max(1, bounds.height),
    );
    content.setAttribute(
      'transform',
      `translate(${page.x + page.width / 2} ${page.y + page.height / 2}) scale(${scale}) translate(${-bounds.x - bounds.width / 2} ${-bounds.y - bounds.height / 2})`,
    );
  }
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  for (const original of sheets) {
    let sheet = original;
    let flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
    const blocks = Array.from(flow.children);
    const photoBlocks = blocks.filter((block) => block.querySelector('.report-photo-frame'));
    if (photoBlocks.length) {
      // Every pair keeps the same image height, including a half-empty last row.
      // Reserve real space for each row's headers/readings before fitting three.
      const measures = photoBlocks.map((block) => {
        const frames = Array.from(block.querySelectorAll<HTMLElement>('.report-photo-frame'));
        // A supporting photo can have fewer header fields than its neighbour.
        // Align the images without adding empty information/reading rows.
        const offsets = frames.map((frame) => frame.getBoundingClientRect().top);
        const top = Math.max(...offsets);
        frames.forEach((frame, index) => {
          frame.style.marginTop = `${top - offsets[index]!}px`;
        });
        const height = Math.max(...frames.map((frame) => frame.getBoundingClientRect().height));
        // EVS/EVD captions and point details are siblings of the photo block.
        // Reserve their space too, otherwise the third pair is pushed out even
        // though the images alone were sized to fit three rows.
        let followingHeight = 0;
        for (let i = blocks.indexOf(block) + 1; i < blocks.length; i++) {
          const following = blocks[i]!;
          if (following.querySelector('.report-photo-frame')) break;
          followingHeight += following.getBoundingClientRect().height;
        }
        return {
          height,
          overhead: block.getBoundingClientRect().height - height + followingHeight,
        };
      });
      const available =
        flow.getBoundingClientRect().height / 3 - Math.max(...measures.map((m) => m.overhead)) - 1;
      // Long measurement tables may need fewer rows; preserve their readable
      // text and a useful photo rather than dropping data to force six images.
      const height = Math.max(
        (35 * 96) / 25.4,
        Math.min(available, ...measures.map((m) => m.height)),
      );
      original.style.setProperty('--report-photo-height', `${height}px`);
    }
    flow.replaceChildren();
    let photoRows = 0;
    for (const block of blocks) {
      const photoRow = !!block.querySelector('.report-photo-frame');
      flow.append(block);
      if (
        (block.getBoundingClientRect().bottom > flow.getBoundingClientRect().bottom + 1 ||
          (photoRow && photoRows >= 3)) &&
        flow.children.length > 1
      ) {
        block.remove();
        const continuation = original.cloneNode(true) as HTMLElement;
        continuation.querySelector('.evs-flow')!.replaceChildren();
        sheet.after(continuation);
        sheet = continuation;
        flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
        flow.append(block);
        photoRows = 0;
      }
      if (photoRow) photoRows++;
      // A pathological single block must never silently run into the next page.
      if (block.getBoundingClientRect().bottom > flow.getBoundingClientRect().bottom + 1)
        throw new Error(
          'Um campo excedeu o espaço de uma página do relatório. Divida o texto em campos menores.',
        );
    }
  }
  const all = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  all.forEach((sheet, i) => {
    sheet.querySelector('.evs-page-number')!.textContent =
      String(i + 1).padStart(2, '0') + '/' + String(all.length).padStart(2, '0');
  });
}
