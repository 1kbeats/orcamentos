-- Corrige somente a grafia de apresentacao do emitente nos documentos.
update public.config
set nome = '1000 BEATS ÁUDIO, VÍDEO E ILUMINAÇÃO LTDA.'
where regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g') = '62496834000197';

-- Mantem os orcamentos ja salvos com a mesma grafia apresentada pela empresa.
update public.orcamentos
set empresa = '1000 BEATS ÁUDIO, VÍDEO E ILUMINAÇÃO LTDA.'
where regexp_replace(coalesce(cnpj_emp, ''), '[^0-9]', '', 'g') = '62496834000197';
