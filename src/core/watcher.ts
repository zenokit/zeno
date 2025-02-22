import { watch, type FSWatcher } from "fs";
import debounce from "@/utils/debounce";
import { loadRoutes } from "./router";

let fileWatcher: FSWatcher | null = null;

function watchRoutes(routesDir: string) {
  if (fileWatcher) return;

  fileWatcher = watch(
    routesDir,
    { recursive: true },
    debounce(async () => {
      console.log("🔄 Rechargement des routes...");
      await loadRoutes(routesDir);
    }, 300)
  );
}

export { watchRoutes };
