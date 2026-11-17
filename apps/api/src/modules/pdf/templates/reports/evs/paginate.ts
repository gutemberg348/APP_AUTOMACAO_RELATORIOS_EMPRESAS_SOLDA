// Executed inside Chromium after fonts/images load, so continuation pages use actual sizes.
export function paginateEvs() {
  for (const heading of document.querySelectorAll<HTMLElement>(
    '.custom-report-sheet .evs-heading',
  )) {
    const text = document.createElement('span');
    text.textContent = heading.textContent;
    heading.replaceChildren(text);
    let size = 23;
    while (
      size > 8 &&
      (text.getBoundingClientRect().height > heading.clientHeight - 12 ||
        text.getBoundingClientRect().width > heading.clientWidth - 12)
    ) {
      size -= 0.5;
      text.style.fontSize = `${size}px`;
    }
  }
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
  // Logical stages can share a model sheet. Mark their content before pagination
  // so an extra page can separate two stages, including their continuation text.
  const stages: [string, string][] = [
    ['identification', '.evs-cover-block,.evs-data-title'],
    ['drawings', '.evs-drawing,.rdo-drawing,.evs-drawing-caption'],
    ['points', '.evs-weld,.reference-photo-row'],
    ['testPhotos', '.lp-test-photo,.th-test-photo-row,.measurement-block'],
    ['generalData', '.lp-general-conditions'],
    ['materials', '.lp-materials'],
    ['discontinuities', '.lp-indications,.lp-legend'],
    ['inspectionRecords', '.evs-direct-records'],
    ['conclusion', '.reference-conclusion,.evs-verdict,.evs-legend,.evs-result,.rdo-observation'],
    ['signatures', '.evs-signers'],
    ['data', '.rdo-repeated'],
  ];
  const normalSheets = () =>
    Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet:not([data-custom-id])'));
  for (const sheet of normalSheets()) {
    for (const [id, selector] of stages)
      for (const block of sheet.querySelectorAll<HTMLElement>(selector))
        block.dataset.reportSection ??= id;
    const title = sheet.querySelector('.evs-heading')?.textContent?.trim();
    const section =
      title === 'DESENHO'
        ? 'drawings'
        : ['SOLDA', 'FOTOS ADICIONAIS'].includes(title ?? '')
          ? 'points'
          : sheet.matches('.measurement-sheet:not(.reference-final)')
            ? 'testPhotos'
            : undefined;
    if (section)
      for (const block of sheet.querySelector<HTMLElement>('.evs-flow')!.children)
        (block as HTMLElement).dataset.reportSection ??= section;
  }
  const sectionOrder: Record<string, string[]> = {
    EVS: ['identification', 'technical', 'drawings', 'points', 'conclusion', 'signatures'],
    EVD: [
      'identification',
      'technical',
      'inspectionRecords',
      'drawings',
      'points',
      'conclusion',
      'signatures',
    ],
    LP: [
      'identification',
      'technical',
      'drawings',
      'testPhotos',
      'points',
      'generalData',
      'materials',
      'discontinuities',
      'conclusion',
      'signatures',
    ],
    TH: ['identification', 'technical', 'manometer', 'testPhotos', 'conclusion', 'signatures'],
    ME: ['identification', 'equipment', 'testPhotos', 'conclusion', 'signatures'],
    RDO: ['data', 'drawings', 'points', 'conclusion', 'signatures'],
  };
  const lastStageBlock = (extra: HTMLElement) => {
    const id = extra.dataset.customSection!;
    const order = sectionOrder[extra.dataset.customReportType!] ?? [];
    // An empty/removed optional stage has no printed block. Insert after the
    // closest preceding stage instead of inventing a blank model page.
    const preceding = [id, ...order.slice(0, Math.max(0, order.indexOf(id))).reverse()];
    for (const candidate of preceding) {
      const blocks = normalSheets().flatMap((sheet) =>
        Array.from(sheet.querySelectorAll<HTMLElement>('[data-report-section]')),
      );
      const block = blocks.filter((block) => block.dataset.reportSection === candidate).at(-1);
      if (block) return block;
    }
    return undefined;
  };
  const separated = new Set<string>();
  for (const extra of document.querySelectorAll<HTMLElement>(
    '[data-custom-position="afterSection"]',
  )) {
    const block = lastStageBlock(extra);
    if (!block || separated.has(block.dataset.reportSection!)) continue;
    separated.add(block.dataset.reportSection!);
    const sheet = block.closest<HTMLElement>('.evs-sheet')!;
    const flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
    const tail = document.createRange();
    if (flow.contains(block)) tail.setStartAfter(block);
    else tail.setStart(flow, 0); // RDO's information table is before the flow.
    tail.setEnd(flow, flow.childNodes.length);
    const following = tail.cloneContents();
    if (!following.textContent?.trim() && !following.querySelector('img,svg,table')) continue;
    const continuation = sheet.cloneNode(true) as HTMLElement;
    continuation.querySelector('.evs-flow')!.replaceChildren(tail.extractContents());
    continuation.querySelector('.rdo-repeated')?.remove();
    for (const part of [sheet, continuation])
      for (const general of part.querySelectorAll<HTMLElement>('.lp-general-page'))
        general.style.height = 'auto';
    sheet.after(continuation);
  }
  const sheets = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  for (const original of sheets) {
    let sheet = original;
    let flow = sheet.querySelector<HTMLElement>('.evs-flow')!;
    const blocks = Array.from(flow.children);
    if (original.classList.contains('lp-test-photos') && blocks.length) {
      const captionHeight = blocks.reduce(
        (total, block) =>
          total + (block.querySelector('figcaption')?.getBoundingClientRect().height ?? 0),
        0,
      );
      const area = flow.getBoundingClientRect();
      // Use the available height equally. A wide photo stops growing at the
      // page width so its actual image ends where the next photo can begin.
      const rowHeight = Math.max(76, (area.height - captionHeight - 0.25) / blocks.length);
      for (const frame of flow.querySelectorAll<HTMLElement>('.lp-test-photo-image')) {
        const image = frame.querySelector('img')!;
        const ratio = image.naturalWidth / image.naturalHeight || 4 / 3;
        frame.style.height = `${Math.min(rowHeight, area.width / ratio)}px`;
      }
    }
    const measurement = original.classList.contains('measurement-sheet');
    const maxPhotoRows = 3;
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
          header: top - block.getBoundingClientRect().top,
          overhead: block.getBoundingClientRect().height - height + followingHeight,
        };
      });
      const leadingHeight = blocks
        .slice(0, blocks.indexOf(photoBlocks[0]!))
        .reduce((height, block) => height + block.getBoundingClientRect().height, 0);
      const available = measurement
        ? (flow.getBoundingClientRect().height - leadingHeight) / 3 -
          Math.max(...measures.map((m) => m.header)) -
          2
        : flow.getBoundingClientRect().height / 3 -
          Math.max(...measures.map((m) => m.overhead)) -
          1;
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
          (photoRow && photoRows >= maxPhotoRows)) &&
        flow.children.length > 1
      ) {
        block.remove();
        const continuation = original.cloneNode(true) as HTMLElement;
        continuation.querySelector('.evs-flow')!.replaceChildren();
        // Repeated RDO headers are context, not another occurrence of the stage.
        continuation.querySelector('.rdo-repeated')?.removeAttribute('data-report-section');
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
  // Distribute TH identification after pagination, using only the spare space.
  // Long fields keep their natural height and continuation pages remain readable.
  for (const flow of document.querySelectorAll<HTMLElement>('.th-identification .evs-flow')) {
    const blocks = Array.from(flow.children);
    if (blocks.length < 2) continue;
    const style = getComputedStyle(flow);
    const available =
      flow.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const used = blocks.reduce((sum, block) => sum + block.getBoundingClientRect().height, 0);
    const gap = Math.max(0, Math.min(30, (available * 0.9 - used) / (blocks.length - 1)));
    flow.style.gap = `${gap}px`;
  }
  // Position extras after pagination so a chosen model page includes continuation sheets.
  const standard = Array.from(
    document.querySelectorAll<HTMLElement>('.evs-sheet:not([data-custom-id])'),
  );
  const extras = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet[data-custom-id]'));
  if (extras.length) {
    const before = new Map<number, HTMLElement[]>();
    let identification = 0;
    standard.forEach((s, i) => {
      if (s.classList.contains('evs-identification')) identification = i;
    });
    let conclusion = standard.findIndex(
      (s) =>
        s.classList.contains('reference-final') ||
        s.querySelector('.evs-heading')?.textContent?.trim() === 'LAUDO FINAL',
    );
    if (conclusion < 0) conclusion = Math.max(0, standard.length - 1);
    let signatures = standard.length - 1;
    standard.forEach((s, i) => {
      if (s.querySelector('.evs-signers')) signatures = i;
    });
    for (const extra of extras) {
      const position = extra.dataset.customPosition;
      const index =
        position === 'start'
          ? 0
          : position === 'afterSection'
            ? (() => {
                const block = lastStageBlock(extra);
                return block ? standard.indexOf(block.closest<HTMLElement>('.evs-sheet')!) + 1 : 0;
              })()
            : position === 'afterIdentification'
              ? Math.min(standard.length, identification + 1)
              : position === 'beforeConclusion'
                ? conclusion
                : position === 'afterPage'
                  ? Math.min(standard.length, Math.max(0, Number(extra.dataset.customAfter) || 1))
                  : position === 'afterSignatures'
                    ? signatures + 1
                    : standard.length;
      const group = before.get(index) ?? [];
      group.push(extra);
      before.set(index, group);
    }
    for (let i = 0; i <= standard.length; i++) {
      const group = before.get(i) ?? [];
      group.sort(
        (a, b) =>
          Number(a.dataset.customPosition === 'end') - Number(b.dataset.customPosition === 'end') ||
          Number(b.dataset.customPosition === 'start') -
            Number(a.dataset.customPosition === 'start'),
      );
      for (const extra of group) document.body.append(extra);
      if (standard[i]) document.body.append(standard[i]!);
    }
  }
  const all = Array.from(document.querySelectorAll<HTMLElement>('.evs-sheet'));
  all.forEach((sheet, i) => {
    sheet.querySelector('.evs-page-number')!.textContent =
      String(i + 1).padStart(2, '0') + '/' + String(all.length).padStart(2, '0');
  });
}
