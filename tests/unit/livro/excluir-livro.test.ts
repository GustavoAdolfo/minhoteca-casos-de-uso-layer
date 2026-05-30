import { ExcluirLivroUseCase } from '../../../layer/nodejs/src/livro/excluir-livro';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';

// Mock parcial do core-layer (acompanhando o padrão de outros testes)
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

describe('ExcluirLivroUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  let consoleErrorSpy: jest.SpyInstance;

  const mockResult: ResultType = {
    data: [],
    limit: 1,
    currentPage: 1,
    totalPages: 1,
    totalDocuments: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  beforeAll(() => {
    // Suprime o console.error gerado pelo bloco catch do caso de uso
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

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
    } as jest.Mocked<RepositoryInterface>;
  });

  // Função utilitária para facilitar a criação de eventos
  const createEvent = (
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  it('deve excluir um livro com sucesso quando o id for informado', async () => {
    repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
    const useCase = new ExcluirLivroUseCase(repoMock);

    const event = createEvent({ id: '12345' });
    const result = await useCase.execute(event);

    expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Livros', '12345');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Livro excluído com sucesso.');
  });

  it('deve retornar erro quando queryStringParameters for null (branch coverage)', async () => {
    const useCase = new ExcluirLivroUseCase(repoMock);

    const event = createEvent(null);
    await expect(useCase.execute(event)).rejects.toThrow(
      'ID do livro é obrigatório para exclusão.'
    );
  });

  it('deve retornar erro quando o id não estiver presente no queryStringParameters (branch coverage)', async () => {
    const useCase = new ExcluirLivroUseCase(repoMock);

    const event = createEvent({ outroParametro: 'abc' });
    await expect(useCase.execute(event)).rejects.toThrow(
      'ID do livro é obrigatório para exclusão.'
    );
  });

  it('deve utilizar o nome da tabela das variáveis de ambiente se estiver definida (branch coverage)', async () => {
    const originalEnv = process.env.TABELA_LIVROS;
    process.env.TABELA_LIVROS = 'Tabela_Mock_Livro';

    try {
      repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
      const useCase = new ExcluirLivroUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Tabela_Mock_Livro', '999');
    } finally {
      process.env.TABELA_LIVROS = originalEnv;
    }
  });

  it('deve tratar e lançar o erro correto quando o repositório falhar (branch coverage)', async () => {
    repoMock.deleteByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));
    const useCase = new ExcluirLivroUseCase(repoMock);

    await expect(useCase.execute(createEvent({ id: '12345' }))).rejects.toThrow(
      'Falha ao excluir livro.'
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
