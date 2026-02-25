import type { PropsWithChildren } from "react";
import { ActionToast, AppActionDock, AppShell, Button, Modal, Toast } from "../components";

export interface AppLayoutProps extends PropsWithChildren {
  isDevBuild: boolean;
}

export function AppLayout({ children, isDevBuild }: AppLayoutProps) {
  return (
    <>
      <AppShell>
        {children}
      </AppShell>
      <AppActionDock />

      <Toast />
      <ActionToast />

      <Modal id="settings-modal" titleId="settings-title" title="Settings">
        <div className="setting-row">
          <span>Day / Night mode</span>
          <div className="mode-toggle" aria-label="Toggle light and dark mode">
            <span className="mode-icon" aria-hidden="true">Day</span>
            <label className="switch">
              <input id="mode-toggle" type="checkbox" />
              <span className="slider"></span>
            </label>
            <span className="mode-icon" aria-hidden="true">Night</span>
          </div>
        </div>
        {isDevBuild ? (
          <div className="setting-row">
            <span>Developer tools</span>
            <Button id="open-devkit" variant="ghost">Open component kitchen sink</Button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
