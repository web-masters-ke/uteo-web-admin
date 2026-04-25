export interface ImpersonateTarget { id: string; label?: string; }
export const impersonate = {
  get(): ImpersonateTarget | null { return null; },
  set(_target: ImpersonateTarget) {},
  clear() {},
  subscribe(_cb: (t: ImpersonateTarget | null) => void) { return () => {}; },
};
