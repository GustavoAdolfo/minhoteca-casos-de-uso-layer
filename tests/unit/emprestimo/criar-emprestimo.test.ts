import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { LogService } from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { CriarEmprestimoUseCase } from '../../../layer/nodejs/src/emprestimo/criar-emprestimo';

jest.mock('@gustavoadolfo/minhoteca-core-layer', () => {
  const actual = jest.requireActual('@gustavoadolfo/minhoteca-core-layer');
  return {
    ...actual,
    LogService: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    })),
  };
});

describe('CriarEmprestimoUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const emprestimoPayload = {
    usuarioId: 'usuario-123',
    livroId: 'livro-456',
    solicitacaoDataHora: '2026-09-13T08:00:00.000Z',
    prazoDias: 15,
    situacao: 'PENDENTE',
    observacao: 'Empréstimo de teste',
  };

  const createEvent = (body: Record<string, unknown> | null = emprestimoPayload): APIGatewayEvent =>
    ({
      body: body ? JSON.stringify(body) : null,
    }) as unknown as APIGatewayEvent;

  beforeEach(() => {
    jest.clearAllMocks();

    repoMock = {
      saveData: jest.fn(),
      getAll: jest.fn(),
      getData: jest.fn(),
      queryData: jest.fn(),
      updateByMinhotecaId: jest.fn(),
      deleteByMinhotecaId: jest.fn(),
      removeData: jest.fn(),
      findByMinhotecaId: jest.fn(),
      getListByMinhotecaIds: jest.fn(),
      getCountFromTable: jest.fn(),
    } as unknown as jest.Mocked<RepositoryInterface>;

    repoMock.saveData.mockResolvedValue({
      data: null,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
      limit: 10,
    } as ResultType);
  });

  const getLogServiceErrorMock = (): jest.Mock => {
    const logServiceInstance = (LogService as unknown as jest.Mock).mock.results.at(-1)?.value as
      { error: jest.Mock } | undefined;

    if (!logServiceInstance) {
      throw new Error('LogService mock não foi inicializado.');
    }

    return logServiceInstance.error;
  };

  it('deve criar o empréstimo em ambas as tabelas e retornar sucesso', async () => {
    const useCase = new CriarEmprestimoUseCase(repoMock);

    const result = await useCase.execute(createEvent(), 'execucao-123');

    expect(repoMock.saveData).toHaveBeenNthCalledWith(
      1,
      'EmprestimoUsuario',
      expect.objectContaining({
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        situacao: 'PENDENTE',
      })
    );
    expect(repoMock.saveData).toHaveBeenNthCalledWith(
      2,
      'EmprestimoLivros',
      expect.objectContaining({
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        situacao: 'PENDENTE',
      })
    );
    expect(result.Code).toBe(201);
    expect(result.Message).toBe('Empréstimo criado com sucesso');
    expect(result.PageData).toEqual([
      expect.objectContaining({
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        situacao: 'PENDENTE',
      }),
    ]);
  });

  it('deve utilizar as tabelas configuradas nas variáveis de ambiente', async () => {
    const originalUsuario = process.env.TABELA_EMPRESTIMO_USUARIO;
    const originalLivro = process.env.TABELA_EMPRESTIMO_LIVROS;

    process.env.TABELA_EMPRESTIMO_USUARIO = 'TabelaEmprestimoUsuarioMock';
    process.env.TABELA_EMPRESTIMO_LIVROS = 'TabelaEmprestimoLivrosMock';

    try {
      const useCase = new CriarEmprestimoUseCase(repoMock);
      await useCase.execute(createEvent());

      expect(repoMock.saveData).toHaveBeenNthCalledWith(1, 'TabelaEmprestimoUsuarioMock', {
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        solicitacaoDataHora: '2026-09-13T08:00:00.000Z',
        prazoDias: 15,
        situacao: 'PENDENTE',
        observacao: 'Empréstimo de teste',
      });
      expect(repoMock.saveData).toHaveBeenNthCalledWith(2, 'TabelaEmprestimoLivrosMock', {
        usuarioId: 'usuario-123',
        livroId: 'livro-456',
        solicitacaoDataHora: '2026-09-13T08:00:00.000Z',
        prazoDias: 15,
        situacao: 'PENDENTE',
        observacao: 'Empréstimo de teste',
      });
    } finally {
      if (originalUsuario === undefined) {
        delete process.env.TABELA_EMPRESTIMO_USUARIO;
      } else {
        process.env.TABELA_EMPRESTIMO_USUARIO = originalUsuario;
      }

      if (originalLivro === undefined) {
        delete process.env.TABELA_EMPRESTIMO_LIVROS;
      } else {
        process.env.TABELA_EMPRESTIMO_LIVROS = originalLivro;
      }
    }
  });

  it('deve lançar erro genérico quando o repositório falhar ao salvar o empréstimo', async () => {
    repoMock.saveData.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));

    const useCase = new CriarEmprestimoUseCase(repoMock);

    await expect(useCase.execute(createEvent(), 'execucao-erro')).rejects.toThrow(
      'Falha ao criar empréstimo.'
    );
    expect(getLogServiceErrorMock()).toHaveBeenCalled();
  });
});
