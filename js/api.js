const Api = {
  async request(path, options = {}) {
    const response = await fetch(CONFIG.SUPABASE_URL + path, {
      ...options,
      headers: CONFIG.headers(options.headers || {})
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
    if (!response.ok) {
      const message = data?.message || data?.error_description || data?.error || `Erro HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  async anonymous(path, options = {}) {
    const response = await fetch(CONFIG.SUPABASE_URL + path, {
      ...options,
      headers: CONFIG.anonymousHeaders(options.headers || {})
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (_) { data = text; }
    }
    if (!response.ok) throw new Error(data?.message || data?.error || `Erro HTTP ${response.status}`);
    return data;
  },

  orgFilter(path) {
    if (!CONFIG.organizationId) throw new Error('Empresa não selecionada.');
    const separator = path.includes('?') ? '&' : '?';
    return path + separator + 'organization_id=eq.' + encodeURIComponent(CONFIG.organizationId);
  },

  orgPayload(data) {
    if (!CONFIG.organizationId) throw new Error('Empresa não selecionada.');
    return { ...data, organization_id: CONFIG.organizationId };
  },

  friendlyError(error, fallback = 'Não foi possível concluir a operação.') {
    if (!error) return fallback;
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
    if (error.status === 403) return 'Você não tem permissão para esta operação.';
    if (error.status === 409 && error.data?.code === '23503') return 'Este registro possui dados vinculados e não pode ser excluído diretamente.';
    if (error.status === 409 && error.data?.code === '23505') return 'Já existe um registro com esses dados.';
    if (error.status === 409) return error.message || fallback;
    return error.message || fallback;
  }
};
