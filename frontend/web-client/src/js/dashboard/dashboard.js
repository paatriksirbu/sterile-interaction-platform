
// src/js/dashboard.js
export function triggerDashboardAction(action) {
  console.log("[Dashboard Action]", action);


  switch (action) {
    case "radiology":
      window.location.href = "/frontend/web-client/src/html/viewer3d.html";
      break;


    case "plan":
      window.location.href = "/frontend/web-client/src/html/surgical_plan.html";
      break;


    case "history":
      window.location.href = "/frontend/web-client/src/html/index.html";
      break;


    case "live":
      window.location.href = "/frontend/web-client/src/html/live_feed.html";
      break;


    default:
      console.warn("No route for action:", action);
  }
}


// Opcional: hover/selección por otros gestos
export function highlightTile(action) {
  document.querySelectorAll(".tile").forEach((t) => t.classList.remove("hover"));
  const t = document.querySelector(`.tile[data-action="${action}"]`);
  if (t) t.classList.add("hover");
}


export function gestureClickTile(action) {
  triggerDashboardAction(action);
}





