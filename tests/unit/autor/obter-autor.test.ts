import { ObterAutorUseCase } from '../../../layer/nodejs/src/autor/obter-autor';
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

describe('ObterAutorUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  let consoleErrorSpy: jest.SpyInstance;

  const autorMockData = {
    id: '1234567890',
    nome: 'autor-mock-name',
    email: 'autor-mock@email.net',
    website: 'http://autor-mock-website.com',
    pais: 'BRA',
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

  const createEvent = (
    pathParameters: Record<string, string> | null = null,
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      pathParameters,
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  it('deve obter uma editora com sucesso utilizando pathParameters', async () => {
    const mockResult: ResultType = {
      data: [autorMockData],
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.queryData.mockResolvedValueOnce(mockResult);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '1234567890' });

    const result = await useCase.execute(event);

    expect(repoMock.queryData).toHaveBeenCalledWith('Autores', [
      {
        attribute: { AttributeName: 'id', AttributeType: 'S' },
        attributeValue: '1234567890',
        partitionKey: false,
        sortKey: false,
      },
    ]);
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Autor obtido com sucesso.');
    expect(result.PageData).toEqual(
      expect.arrayContaining([expect.objectContaining({ nome: 'autor-mock-name' })])
    );
  });

  it('deve obter uma editora com sucesso utilizando queryStringParameters (fallback de id)', async () => {
    const mockResult: ResultType = {
      data: [autorMockData],
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.queryData.mockResolvedValueOnce(mockResult);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent(null, { id: '9999' });

    await useCase.execute(event);

    expect(repoMock.queryData).toHaveBeenCalledWith(
      'Autores',
      expect.arrayContaining([expect.objectContaining({ attributeValue: '9999' })])
    );
  });

  it('deve retornar 404 e usar logger.warn quando o repositório não retornar uma result válida', async () => {
    // Simulando retorno null que aciona a branch `if (result)` false
    repoMock.queryData.mockResolvedValueOnce(null as unknown as ResultType);

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: 'nao-existe' });

    const result = await useCase.execute(event);

    expect(result.Code).toBe(404);
    expect(result.Message).toBe('Autor não encontrado.');
    expect(result.PageData).toEqual([]);
  });

  it('deve lançar erro genérico no log (e retornar falha) quando nenhum ID for informado', async () => {
    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent(null, null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter autor.');
  });

  it('deve lançar erro genérico quando o repositório falhar internamente', async () => {
    repoMock.queryData.mockRejectedValueOnce(new Error('Erro interno no banco de dados'));

    const useCase = new ObterAutorUseCase(repoMock);
    const event = createEvent({ id: '123' });

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao obter autor.');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('deve utilizar o nome da tabela das variáveis de ambiente se estiver definida (branch coverage)', async () => {
    const originalEnv = process.env.TABELA_AUTORES;
    process.env.TABELA_AUTORES = 'Tabela_Mock_Autor_Obter';

    try {
      repoMock.queryData.mockResolvedValueOnce({ data: [autorMockData] } as ResultType);
      const useCase = new ObterAutorUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.queryData).toHaveBeenCalledWith('Tabela_Mock_Autor_Obter', expect.any(Array));
    } finally {
      process.env.TABELA_AUTORES = originalEnv;
    }
  });
});
