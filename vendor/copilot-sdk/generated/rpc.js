function createServerRpc(connection) {
  return {
    ping: async (params) => connection.sendRequest("ping", params),
    models: {
      list: async () => connection.sendRequest("models.list", {})
    },
    tools: {
      list: async (params) => connection.sendRequest("tools.list", params)
    },
    account: {
      getQuota: async () => connection.sendRequest("account.getQuota", {})
    }
  };
}
function createSessionRpc(connection, sessionId) {
  return {
    model: {
      getCurrent: async () => connection.sendRequest("session.model.getCurrent", { sessionId }),
      switchTo: async (params) => connection.sendRequest("session.model.switchTo", { sessionId, ...params })
    }
  };
}
export {
  createServerRpc,
  createSessionRpc
};
