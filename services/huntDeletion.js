export function canDeleteHunt({ sessionId, currentSession }) {
  if (!sessionId) return false;
  if (!currentSession || currentSession.sessionId !== sessionId) return true;
  return currentSession.status === "ended";
}

export async function deleteHuntData({
  sessionId,
  sessionsRepository,
  encountersRepository
}) {
  if (!sessionId) {
    throw new TypeError("deleteHuntData: sessionId is required");
  }
  if (!sessionsRepository?.getCurrentReadOnly) {
    throw new TypeError(
      "deleteHuntData: sessionsRepository.getCurrentReadOnly is required"
    );
  }
  if (!sessionsRepository?.deleteSession) {
    throw new TypeError("deleteHuntData: sessionsRepository.deleteSession is required");
  }
  if (!encountersRepository?.deleteBySessionId) {
    throw new TypeError(
      "deleteHuntData: encountersRepository.deleteBySessionId is required"
    );
  }

  const currentSession = await sessionsRepository.getCurrentReadOnly();
  if (!canDeleteHunt({ sessionId, currentSession })) {
    throw new Error("End the current Hunt before deleting it");
  }

  const deletingCurrent = currentSession?.sessionId === sessionId;

  // Delete dependent encounter rows first. If the second step fails, a
  // session without encounters is safe to retry; the inverse would leave
  // encounters pointing at a session that no longer exists.
  await encountersRepository.deleteBySessionId(sessionId);
  await sessionsRepository.deleteSession(sessionId);

  return { deletingCurrent };
}
