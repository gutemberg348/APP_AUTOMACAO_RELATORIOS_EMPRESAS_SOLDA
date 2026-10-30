import { describe, expect, it, vi } from 'vitest';
import { createDrawingFrameQueue } from '../../../app/features/reports/drawing-frame-queue';

describe('drawing gesture frame queue', () => {
  it('coalesces many input positions into one visual update and keeps the latest position', () => {
    let callback = () => {};
    const request = vi.fn((next: () => void) => {
      callback = next;
      return 1;
    });
    const apply = vi.fn();
    const queue = createDrawingFrameQueue<number>(apply, request, vi.fn());
    for (let i = 0; i < 100; i++) queue.push(i);
    expect(request).toHaveBeenCalledOnce();
    expect(apply).not.toHaveBeenCalled();
    callback();
    expect(apply).toHaveBeenCalledExactlyOnceWith(99);
    queue.push(100);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('flushes before release and discards a pending update on cancellation', () => {
    const apply = vi.fn(),
      cancel = vi.fn();
    const queue = createDrawingFrameQueue<number>(apply, () => 1, cancel);
    queue.push(10);
    queue.flush();
    expect(apply).toHaveBeenCalledExactlyOnceWith(10);
    queue.push(20);
    queue.clear();
    queue.flush();
    expect(apply).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
