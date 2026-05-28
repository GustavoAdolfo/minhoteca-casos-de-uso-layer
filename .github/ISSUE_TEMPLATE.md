## Validar dependências antes de exclusão de registros

### Descrição
Esta tarefa descreve a necessidade de implementar validação de relacionamentos de dependência entre dados antes de excluir um registro nos casos de uso de exclusão de todas as entidades do projeto Minhoteca.

### Objetivo
Garantir que nenhum registro seja excluído sem antes verificar se existem outras entidades que dependem dele, evitando inconsistências de dados e violações de integridade referencial.

### Contexto
Nos casos de uso de exclusão (delete use cases) implementados na camada de negócios (minhoteca-casos-de-uso-layer), é necessário validar se um registro possui dependências ativas antes de permitir sua exclusão. Isso é crítico para manter a consistência dos dados e evitar operações destrutivas que possam comprometer a integridade da aplicação.

### Critérios de Aceitação
- [ ] Implementar validação de dependências nos casos de uso de exclusão
- [ ] Validar relacionamentos para todas as entidades (Editora, País, Autor, Livro, etc.)
- [ ] Retornar mensagem de erro clara quando há dependências ativas
- [ ] Documentar o comportamento esperado para cada entidade
- [ ] Adicionar testes unitários e de integração
- [ ] Atualizar documentação técnica

### Tarefas
- [ ] Analisar estrutura de relacionamentos entre entidades
- [ ] Definir regras de validação para cada caso de uso de exclusão
- [ ] Implementar validações nos use cases
- [ ] Realizar testes
- [ ] Documentar

### Prioridade
Média/Alta

### Data limite
15/06/2026
