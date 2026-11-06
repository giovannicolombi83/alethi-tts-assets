/* MOBILIS IN MOBILI — le 42 Memory card (dalle immagini della mod TTS, settembre 2026).
   type: camera da cui si ridistribuisce. req: requisito base. fate: 'K' (nodo di Bowen, ⌘) o 'A' (anarchia) o null.
   ship: icona Warship (evoca una nave). fx: effetti da sinistra a destra.
   Effetti: '+T' tesoro, '-T' consuma tesoro, '+B' lampadina, '+U' Uprising, '+S' marinaio, '-S' perdi marinaio,
   '-W' consuma relitto, e squilibri 'I:NW' (quadrante) o 'I:W' (metà: si sceglie il quadrante se il token è al centro). */
(function (root) {
const C = [
  ['Abyssal Cuisine', 'EXPLORE', 1, null, 0, ['I:NW']],
  ['Gold, Zinc and Silver Mines', 'EXPLORE', 2, 'K', 0, ['+T', 'I:NW']],
  ['Pearl Hunters', 'EXPLORE', 2, 'K', 1, ['+T', '+B', 'I:NW']],
  ['Secret Passage', 'REVOLUTION', 1, 'A', 0, ['-T', 'I:SE']],
  ['Mysterious Island', 'EXPLORE', 2, 'K', 1, ['+T', 'I:NW', 'I:W']],
  ['Suez Canal', 'EXPLORE', 3, 'K', 0, ['+T', '+U', 'I:W']],
  ['Wreck of the Florida Sunderland', 'EXPLORE', 3, 'K', 0, ['I:NW', 'I:NW']],
  ['Hunting Expedition on Crespo Island', 'EXPLORE', 3, 'K', 0, ['+T', '+B', 'I:W']],
  ['Plankton', 'EXPLORE', 3, 'K', 0, ['+T', 'I:NW']],
  ['Santorini', 'EXPLORE', 3, null, 0, ['+T', 'I:W', 'I:SW']],
  ['Submerged Coal and Sodium Mines', 'EXPLORE', 4, 'K', 0, ['+T', '+T', 'I:SW', 'I:NW']],
  ['Torres Streit', 'EXPLORE', 4, 'K', 0, ['+T', '+T', 'I:SW']],
  ['Vanikoro', 'EXPLORE', 4, 'K', 0, ['+T', 'I:NW', 'I:NW']],
  ['Telegraph Cable', 'EXPLORE', 2, 'K', 0, ['I:NW']],
  ['Atlantis', 'EXPLORE', 4, 'K', 0, ['+T', '+B', 'I:E']],
  ['Conquest of the South Pole', 'EXPLORE', 4, 'K', 0, ['I:NW', 'I:NW']],
  ['Steel Hull', 'INNOVATE', 1, null, 1, ['+B', 'I:SW']],
  ['Electric Energy', 'INNOVATE', 2, null, 1, ['-W', '+B', 'I:SW']],
  ['Library', 'INNOVATE', 2, null, 0, ['-W', '+B', 'I:SW']],
  ['Air Self-Sufficiency', 'INNOVATE', 3, null, 0, ['-W', '+T', '+B', 'I:SW']],
  ['Sodium Batteries', 'INNOVATE', 3, null, 0, ['+B', 'I:W']],
  ['Glass Cage and Electric Beacon', 'INNOVATE', 3, null, 1, ['-W', '+B', 'I:S']],
  ['Leyden Rifles', 'INNOVATE', 4, null, 0, ['-W', '+B', 'I:SW', 'I:SW']],
  ['Rouquayrol Denayrouze', 'INNOVATE', 5, null, 0, ['-T', '+B', 'I:W', 'I:S']],
  ["Ned Land's Fury", 'ATTACK', 2, null, 0, ['-T', 'I:E']],
  ['Assault on the Warship', 'ATTACK', 3, 'A', 0, ['I:E', 'I:S']],
  ['I Am the Law', 'ATTACK', 3, 'A', 0, ['I:N', 'I:N']],
  ['Prisoners', 'ATTACK', 2, 'A', 1, ['+S', 'I:N']],
  ['Sonata', 'REVOLUTION', 3, null, 0, ['I:E', 'I:N']],
  ['Attack on the Abraham Lincoln', 'ATTACK', 2, 'A', 0, ['+S', 'I:N']],
  ['Drugged Guests', 'ATTACK', 4, null, 0, ['I:S', 'I:W']],
  ['Fight with the Squid', 'ATTACK', 3, 'K', 0, ['-S', 'I:S', 'I:E']],
  ['Family Remembrance', 'INNOVATE', 3, null, 0, ['+B', 'I:N']],
  ['Rescue of the Pearl Diver', 'REVOLUTION', 2, 'A', 1, ['-T', '+U', 'I:S']],
  ['Rescue of Shipwreck Survivors', 'REVOLUTION', 2, 'A', 0, ['+S', 'I:SE']],
  ['Delivery of Bullion', 'REVOLUTION', 2, 'A', 1, ['-T', '+U', 'I:SE']],
  ['Uncontrollable Fury', 'REVOLUTION', 2, 'A', 0, ['+U', 'I:SE']],
  ['Coral Cemetery', 'REVOLUTION', 4, 'A', 1, ['-S', '+U', '-T', 'I:SE', 'I:SE']],
  ['Courage!', 'REVOLUTION', 3, 'A', 0, ['+U', 'I:SE']],
  ['Treasure Recovery from Shipwrecks', 'REVOLUTION', 2, 'A', 0, ['-T', '+U', 'I:SE']],
  ['La Vengeur', 'REVOLUTION', 3, 'A', 0, ['+U', 'I:SE']],
  ['South Pole Ice Pack', 'REVOLUTION', 4, 'K', 0, ['I:W', 'I:N']]
].map((c, i) => ({ id: i, title: c[0], type: c[1], req: c[2], fate: c[3], ship: !!c[4], fx: c[5] }));
root.MIM_CARDS = C;
if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
