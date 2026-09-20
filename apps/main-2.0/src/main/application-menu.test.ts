import { beforeEach, describe, expect, it, vi } from "vitest";
import { app, Menu } from "electron";
import { installApplicationMenu } from "./application-menu";

interface MenuEntry { label?: string; role?: string; accelerator?: string; submenu?: MenuEntry[]; click?: () => void }

vi.mock("electron", () => ({
  app: { setAboutPanelOptions: vi.fn(), quit: vi.fn() },
  Menu: { setApplicationMenu: vi.fn(), buildFromTemplate: vi.fn((template: MenuEntry[]) => template) },
}));
beforeEach(() => vi.clearAllMocks());

function install(platform: NodeJS.Platform) {
  const events: string[] = [];
  const runIndexSync = vi.fn();
  installApplicationMenu({
    productName: "agent-recall-v2",
    openSettings: () => { events.push("show", "open-settings"); },
    refresh: () => { runIndexSync(true); },
  }, platform);
  return { app, Menu, runIndexSync, events };
}

describe("application menu characterization", () => {
  it("preserves native roles, accelerators and command routing on macOS", () => {
    const h = install("darwin");
    const template = vi.mocked(h.Menu.buildFromTemplate).mock.calls[0][0] as MenuEntry[];
    expect(template.map(item => item.label)).toEqual(["agent-recall-v2", "File", "Edit", "View", "Window"]);
    expect(h.app.setAboutPanelOptions).toHaveBeenCalledWith({ applicationName: "agent-recall-v2" });
    const settings = template[0].submenu!.find(item => item.label === "Settings...")!;
    expect(settings.accelerator).toBe("Command+,");
    settings.click!();
    expect(h.events).toEqual(["show", "open-settings"]);
    const refresh = template[3].submenu!.find(item => item.label === "Refresh Now")!;
    expect(refresh.accelerator).toBe("CmdOrCtrl+R");
    refresh.click!();
    expect(h.runIndexSync).toHaveBeenCalledWith(true);
    template[0].submenu!.find(item => item.label === "Quit agent-recall-v2")!.click!();
    expect(h.app.quit).toHaveBeenCalledOnce();
    expect(template[2].submenu!.filter(item => item.role).map(item => item.role)).toEqual(["undo", "redo", "cut", "copy", "paste", "selectAll"]);
    expect(h.Menu.setApplicationMenu).toHaveBeenCalledWith(template);
  });

  it.each(["linux", "win32"] as const)("keeps the application menu absent on %s", platform => {
    const h = install(platform);
    expect(h.Menu.setApplicationMenu).toHaveBeenCalledWith(null);
    expect(h.Menu.buildFromTemplate).not.toHaveBeenCalled();
    expect(h.app.setAboutPanelOptions).not.toHaveBeenCalled();
  });
});
