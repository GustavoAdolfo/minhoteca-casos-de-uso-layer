import { ExcluirAutorUseCase } from '../../../layer/nodejs/src/autor/excluir-autor';
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

describe('ExcluirAutorUseCase', () => {
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

  it('deve excluir um autor com sucesso quando o id for informado', async () => {
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
    repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
    const useCase = new ExcluirAutorUseCase(repoMock);

    const event = createEvent({ id: '12345' });
    const result = await useCase.execute(event);

    expect(repoMock.getAll).toHaveBeenCalled();
    expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Autores', '12345');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Autor excluído com sucesso.');
  });

  it('deve lançar erro quando existirem livros associados ao autor', async () => {
    repoMock.getAll.mockResolvedValueOnce({
      data: [{ id: 'livro-1', titulo: 'Livro Teste' }],
    } as unknown as ResultType);

    const useCase = new ExcluirAutorUseCase(repoMock);
    const event = createEvent({ id: '12345' });

    await expect(useCase.execute(event)).rejects.toThrow(
      'Não é possível excluir o autor porque existem livros associados a ele.'
    );

    expect(repoMock.getAll).toHaveBeenCalled();
    expect(repoMock.deleteByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve retornar erro quando queryStringParameters for null (branch coverage)', async () => {
    const useCase = new ExcluirAutorUseCase(repoMock);

    const event = createEvent(null);
    await expect(useCase.execute(event)).rejects.toThrow(
      'ID do autor é obrigatório para exclusão.'
    );
  });

  it('deve retornar erro quando o id não estiver presente no queryStringParameters (branch coverage)', async () => {
    const useCase = new ExcluirAutorUseCase(repoMock);

    const event = createEvent({ outroParametro: 'abc' });
    await expect(useCase.execute(event)).rejects.toThrow(
      'ID do autor é obrigatório para exclusão.'
    );
  });

  it('deve utilizar o nome da tabela das variáveis de ambiente se estiver definida (branch coverage)', async () => {
    const originalEnv = process.env.TABELA_AUTORES;
    process.env.TABELA_AUTORES = 'Tabela_Mock_Autor';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
      repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
      const useCase = new ExcluirAutorUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Tabela_Mock_Autor', '999');
    } finally {
      process.env.TABELA_AUTORES = originalEnv;
    }
  });

  it('deve tratar e lançar o erro correto quando o repositório falhar (branch coverage)', async () => {
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
    repoMock.deleteByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));
    const useCase = new ExcluirAutorUseCase(repoMock);

    await expect(useCase.execute(createEvent({ id: '12345' }))).rejects.toThrow(
      'Falha ao excluir autor.'
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
