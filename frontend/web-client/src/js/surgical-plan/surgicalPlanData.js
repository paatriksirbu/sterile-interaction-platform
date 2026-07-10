export const SURGICAL_STEPS = [
  {
    id: 1,
    title: "Patient Positioning",
    detail:
      "Position patient supine with knee flexed at 90°. Apply tourniquet to upper thigh.",
    duration: "5 min",
    completed: false,
  },
  {
    id: 2,
    title: "Sterile Preparation",
    detail:
      "Prep and drape the surgical site. Confirm sterile field integrity.",
    duration: "3 min",
    completed: false,
  },
  {
    id: 3,
    title: "Incision & Exposure",
    detail:
      "Make midline longitudinal incision. Perform medial parapatellar arthrotomy.",
    duration: "8 min",
    completed: false,
  },
  {
    id: 4,
    title: "Bone Resection - Femur",
    detail:
      "Perform distal femoral cut using intramedullary alignment. Check valgus angle 5-7°.",
    duration: "10 min",
    completed: false,
  },
  {
    id: 5,
    title: "Bone Resection - Tibia",
    detail:
      "Perform proximal tibial cut with extramedullary guide. Target 3° posterior slope.",
    duration: "8 min",
    completed: false,
  },
  {
    id: 6,
    title: "Trial Components",
    detail:
      "Insert trial femoral and tibial components. Check range of motion and alignment.",
    duration: "5 min",
    completed: false,
  },
  {
    id: 7,
    title: "Implant Placement",
    detail:
      "Cement definitive components. Ensure proper positioning and cement penetration.",
    duration: "10 min",
    completed: false,
  },
  {
    id: 8,
    title: "Closure",
    detail:
      "Close arthrotomy in layers. Apply sterile dressing. Release tourniquet.",
    duration: "6 min",
    completed: false,
  },
];

export const PREOP_CHECKLIST = [
  { id: 1, label: "Patient identity verified", checked: false },
  { id: 2, label: "Consent form signed", checked: false },
  { id: 3, label: "Site marked correctly", checked: false },
  { id: 4, label: "Implants available & verified", checked: false },
  { id: 5, label: "Antibiotics administered", checked: false },
  { id: 6, label: "Imaging reviewed", checked: false },
];

export const MODEL_VIEWS = {
  front: { position: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0] },
  side: { position: [6, 0.5, 0], target: [0, 0, 0], up: [0, 1, 0] },
  top: { position: [0, 6, 0.5], target: [0, 0, 0], up: [0, 0, -1] },
  posterior: { position: [0, 0, -6], target: [0, 0, 0], up: [0, 1, 0] },
};

export function getCountdown(
  scheduledTime = "09:30",
  currentDate = new Date(),
) {
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const scheduled = new Date(currentDate);
  scheduled.setHours(hours, minutes, 0, 0);

  const diff = scheduled - currentDate;
  if (diff < 0) return "IN PROGRESS";

  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);

  return `T-${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
