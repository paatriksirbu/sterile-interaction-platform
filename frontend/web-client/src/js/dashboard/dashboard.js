
// src/js/dashboard.js
export function triggerDashboardAction(action) {
  console.log("[Dashboard Action]", action);


  switch (action) {
    case "radiology":
      window.location.href = "/src/html/viewer3d.html";
      break;


    case "plan":
      window.location.href = "/src/html/surgical_plan.html";
      break;


    case "history":
      window.location.href = "/src/html/index.html";
      break;


    case "live":
      window.location.href = "/src/html/live_feed.html";
      break;


    default:
      console.warn("No route for action:", action);
  }
}

