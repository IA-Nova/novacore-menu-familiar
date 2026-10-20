// Una preferencia por integrante. Solo cuentan los votos de integrantes activos.
export const DISH_VOTES = Object.freeze(['like', 'dislike']);
export function nextDishVote(current, selected) {
  if (!DISH_VOTES.includes(selected)) throw new Error('Voto no válido.');
  return current === selected ? null : selected;
}

export function dishVoteSummary(dishId, votesByDish = {}, familyUsers = [], currentUid = '') {
  const raw = votesByDish?.[dishId]?.votes;
  const votes = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const active = new Set((familyUsers || []).filter(u => u.status === 'active').map(u => u.uid));
  const userVote = active.has(currentUid) && DISH_VOTES.includes(votes[currentUid]) ? votes[currentUid] : null;
  let likes = 0;
  let dislikes = 0;
  for (const uid of active) {
    if (votes[uid] === 'like') likes++;
    if (votes[uid] === 'dislike') dislikes++;
  }
  return { likes, dislikes, userVote };
}
