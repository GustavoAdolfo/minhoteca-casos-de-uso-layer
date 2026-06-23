# Changelog

Todos as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/),
e este projeto segue [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Implementação dos casos de uso para a entidade `Pais`.

### Refactored

- Implementação de classes de erro específicas para `Autor`, `Editora`, `Livro` e `Pais` (#137).

## [0.3.0] - 2025-01-01

### Added

- Implementação dos casos de uso para a entidade `Livro` (#4).

### Refactored

- Revisões e melhorias nos casos de uso de `Autor`.
- Atualização da cobertura de testes.

## [0.2.0] - 2024-12-20

### Added

- Implementação dos casos de uso para a entidade `Autor` (#3).

### Refactored

- Ajustes nos casos de uso de `Editora` (#1).

## [0.1.4] - 2024-12-15

### Added

- Validação de dependências na operação de exclusão de `Editora` — impede exclusão quando há livros associados.
- Lançamento de erros para ID de editora inválido no `ExcluirEditoraUseCase`.

### Tests

- Cobertura do cenário de não exclusão de editora com livros associados.

## [0.1.3] - 2024-12-13

### Dependencies

- Atualização de `@aws-sdk/node-http-handler` de 3.370.0 para 3.374.0.
- Atualização de `aws-lambda` de 1.0.6 para 1.0.7.

## [0.1.2] - 2024-12-12

### Infrastructure

- Revisão e melhorias na implementação do Terraform.

## [0.1.1] - 2024-12-11

### Infrastructure

- Revisão inicial da implementação do Terraform.

## [0.1.0] - 2024-12-10

### Initial Release

Primeira versão publicando a base do projeto:

- Estrutura inicial do projeto voltada para serverless (Lambda Layer).
- Casos de uso da entidade `Editora`.
- Configuração e provisionamento de infraestrutura via Terraform.
- Scripts de automação e workflows de CI/CD no GitHub Actions.
