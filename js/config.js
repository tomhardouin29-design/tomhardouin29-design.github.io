/* ==========================================================
   CONFIGURATION DE L'INSTITUT
   Modifiez ce fichier pour adapter le site à votre salon :
   nom, horaires, équipe, prestations, tarifs…
   ========================================================== */

const SALON = {
  name: "Institut Belle & Zen",
  tagline: "Soins du visage, du corps & beauté des mains",
  address: "12 rue des Lilas, 75000 Paris",
  phone: "01 23 45 67 89",

  // Adresse qui reçoit le récapitulatif de fin de journée
  recapEmail: "",

  // Pas des créneaux proposés (en minutes)
  slotStep: 15,

  // Nombre de jours ouverts à la réservation en ligne
  bookingWindowDays: 45,

  // Délai minimum avant un RDV en ligne (en minutes)
  minNoticeMinutes: 60,

  // Horaires d'ouverture : 0 = dimanche … 6 = samedi. null = fermé
  hours: {
    0: null,
    1: null,
    2: ["09:30", "19:00"],
    3: ["09:30", "19:00"],
    4: ["09:30", "20:00"],
    5: ["09:30", "19:00"],
    6: ["09:00", "17:00"],
  },

  // L'équipe. days = jours travaillés (0 = dimanche … 6 = samedi)
  staff: [
    { id: "lea",   name: "Léa",   color: "#c47a86", days: [2, 3, 4, 5, 6] },
    { id: "sarah", name: "Sarah", color: "#7a9e87", days: [2, 3, 5, 6] },
    { id: "emma",  name: "Emma",  color: "#8a86c4", days: [3, 4, 5, 6] },
  ],

  // Prestations : duration en minutes, price en euros
  services: [
    { id: "v-eclat",    cat: "Soins du visage", name: "Soin éclat",                 duration: 60, price: 65 },
    { id: "v-hydra",    cat: "Soins du visage", name: "Soin hydratant profond",     duration: 75, price: 79 },
    { id: "v-express",  cat: "Soins du visage", name: "Soin express",               duration: 30, price: 39 },
    { id: "c-massage",  cat: "Corps",           name: "Massage relaxant",           duration: 60, price: 70 },
    { id: "c-gommage",  cat: "Corps",           name: "Gommage corps",              duration: 45, price: 55 },
    { id: "e-sourcils", cat: "Épilations",      name: "Sourcils",                   duration: 15, price: 14 },
    { id: "e-levre",    cat: "Épilations",      name: "Lèvre supérieure",           duration: 15, price: 10 },
    { id: "e-aisselles",cat: "Épilations",      name: "Aisselles",                  duration: 15, price: 15 },
    { id: "e-demi",     cat: "Épilations",      name: "Demi-jambes",                duration: 30, price: 25 },
    { id: "e-jambes",   cat: "Épilations",      name: "Jambes complètes",           duration: 45, price: 38 },
    { id: "e-maillot",  cat: "Épilations",      name: "Maillot intégral",           duration: 30, price: 35 },
    { id: "m-manucure", cat: "Mains & pieds",   name: "Manucure",                   duration: 45, price: 35 },
    { id: "m-semi",     cat: "Mains & pieds",   name: "Pose vernis semi-permanent", duration: 60, price: 42 },
    { id: "m-pedi",     cat: "Mains & pieds",   name: "Beauté des pieds",           duration: 60, price: 45 },
    { id: "r-cils",     cat: "Regard",          name: "Rehaussement de cils",       duration: 60, price: 59 },
    { id: "r-teinture", cat: "Regard",          name: "Teinture cils ou sourcils",  duration: 20, price: 18 },
  ],

  paymentMethods: ["CB", "Espèces", "Chèque", "Carte cadeau"],
};
