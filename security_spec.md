# Especificação de Segurança Firestore — Célula Viva

## 1. Invariantes de Dados (Data Invariants)
1. **Isolamento de Célula e Controle de Acesso (RBAC)**: Nenhum documento de célula (`members`, `monthlyPlans`, `meetingReports`, `studyMaterials`, `notifications`) pode existir sem um `cellId` válido existente em `/cells/{cellId}` e sem `ownerUid`/`allowedEmails` correspondentes.
2. **Limite Estrutural de Liderança e Discipulado**:
   - Uma célula (`cells/{cellId}`) pode ter no máximo **3** `trainerEmails` (Líderes em Treinamento).
   - Um mentor (`members/{mentorId}`) pode ter no máximo **3** `menteeIds` (Filhinhos).
3. **Isolamento de PII (Pillar 6)**: Dados pessoais sensíveis (`phone`, `address`, `birthDate`, `baptismDate`, `notes`, `email`) residem exclusivamente em `/members/{memberId}/private/info`, com leitura permitida apenas ao Líder, aos Líderes em Treinamento da célula ou ao próprio membro (`email == request.auth.token.email`).
4. **Integridade Temporal e Imutabilidade**: `createdAt` é imutável após a criação e deve igualar `request.time`; `updatedAt` deve igualar `request.time` em criações e atualizações. `ownerUid`, `cellId` e `createdBy` são imutáveis.
5. **Bloqueio de Estado Terminal**: Relatórios com `status == "Finalizado"` não podem ser alterados por Líderes em Treinamento ou Filhinhos (apenas pelo Líder proprietário ou Admin bootstrap).
6. **Autenticação Verificada**: Todas as operações de escrita e leitura exigem `request.auth != null && request.auth.token.email_verified == true`.

## 2. Os 12 Payloads Maliciosos ("Dirty Dozen")

1. **Identity Spoofing em `users/{userId}`**: Usuário A tenta criar `/users/userB` com `uid: "userB"`. (Esperado: `PERMISSION_DENIED`)
2. **Shadow Field Injection em `monthlyPlans/{planId}`**: Payload válido com campo fantasma `isAdminOverride: true`. (Esperado: `PERMISSION_DENIED`)
3. **Excesso de Líderes em Treinamento em `cells/{cellId}`**: Líder tenta gravar `trainerEmails` com 4 e-mails (`size() == 4 > 3`). (Esperado: `PERMISSION_DENIED`)
4. **Excesso de Filhinhos em `members/{memberId}`**: Líder tenta gravar `menteeIds` com 4 IDs (`size() == 4 > 3`). (Esperado: `PERMISSION_DENIED`)
5. **Escalada de Privilégio por Filhinho**: Usuário com papel `filhinho` tenta criar ou atualizar documento em `/members/{id}` ou `/cells/{id}`. (Esperado: `PERMISSION_DENIED`)
6. **Leitura Indevida de PII (`members/{memberId}/private/info`)**: Usuário `filhinho` ou `membro` tenta ler `private/info` de outro membro da célula. (Esperado: `PERMISSION_DENIED`)
7. **Falsificação de Timestamp (`createdAt` retroativo)**: Payload de criação envia `createdAt` do cliente diferente de `request.time`. (Esperado: `PERMISSION_DENIED`)
8. **ID Poisoning**: Tentativa de gravação em `/monthlyPlans/invalid@id!#123456` com caracteres fora de `^[a-zA-Z0-9_-]+$`. (Esperado: `PERMISSION_DENIED`)
9. **Escrita Órfã (`cellId` inexistente)**: Payload em `/studyMaterials/{id}` aponta para `cellId: "celula-fantasma"`. (Esperado: `PERMISSION_DENIED`)
10. **Email Spoofing (e-mail não verificado)**: Requisição com `email: "amigodeDeus943004073@gmail.com"` e `email_verified: false`. (Esperado: `PERMISSION_DENIED`)
11. **Mutação de Relatório Finalizado por Treinador**: Líder em Treinamento tenta alterar `summary` de um `/meetingReports/{id}` que já está com `status: "Finalizado"`. (Esperado: `PERMISSION_DENIED`)
12. **Query Scraping (`allow list` sem autorização)**: Usuário externo não listado em `allowedEmails` tenta listar `/monthlyPlans` ou `/meetingReports`. (Esperado: `PERMISSION_DENIED`)
