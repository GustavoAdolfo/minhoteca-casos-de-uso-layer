import { ObterPaisUseCase } from '../../../layer/nodejs/src/pais/obter-pais';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { LogService, PaisInvalidoError } from '@gustavoadolfo/minhoteca-core-layer';
import { APIGatewayEvent } from 'aws-lambda';

// Mock parcial do core-layer para isolar o LogService
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

describe('ObterPaisUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const paisMockData = {
    isoNumeric: 76,
    nome: 'Brasil',
    nomePortugues: 'Brasil',
    bandeira: 'data:image/png;base64,...',
    isoAlpha3: 'BRA',
    isoAlpha2: 'BR',
  };

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

  it('deve obter um país com sucesso utilizando pathParameters', async () => {
    const mockResult: ResultType = {
      data: [paisMockData],
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.queryData.mockResolvedValueOnce(mockResult);

    const useCase = new ObterPaisUseCase(repoMock);
    const event = createEvent({ id: '76' });

    const result = await useCase.execute(event);

    expect(repoMock.queryData).toHaveBeenCalledWith('Paises', [
      {
        attribute: {
          AttributeName: 'isoNumeric',
          AttributeType: 'S',
        },
        attributeValue: '76',
        partitionKey: false,
        sortKey: false,
      },
    ]);
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('País obtido com sucesso.');
    expect(result.PageData).toEqual([expect.objectContaining({ nome: 'Brasil' })]);
  });

  it('deve obter um país com sucesso utilizando queryStringParameters como fallback', async () => {
    const mockResult: ResultType = { data: [paisMockData] } as ResultType;
    repoMock.queryData.mockResolvedValueOnce(mockResult);

    const useCase = new ObterPaisUseCase(repoMock);
    const event = createEvent(null, { id: '76' });

    await useCase.execute(event);

    expect(repoMock.queryData).toHaveBeenCalledWith('Paises', [
      {
        attribute: {
          AttributeName: 'isoNumeric',
          AttributeType: 'S',
        },
        attributeValue: '76',
        partitionKey: false,
        sortKey: false,
      },
    ]);
  });

  it('deve retornar 404 quando o país não for encontrado', async () => {
    const mockResult: ResultType = { data: [] } as ResultType;
    repoMock.queryData.mockResolvedValueOnce(mockResult);

    const useCase = new ObterPaisUseCase(repoMock);
    const event = createEvent({ id: 'nao-existe' });

    const result = await useCase.execute(event);

    expect(result.Code).toBe(404);
    expect(result.Message).toBe('País não encontrado.');
    expect(result.PageData).toEqual([]);
    const logServiceInstance = (LogService as jest.Mock).mock.results[0].value;
    expect(logServiceInstance.warn).toHaveBeenCalledWith('País com id nao-existe não encontrado.');
  });

  it('deve lançar PaisInvalidoError quando nenhum ID for informado', async () => {
    const useCase = new ObterPaisUseCase(repoMock);
    const event = createEvent(null, null);

    await expect(useCase.execute(event)).rejects.toThrow(
      new PaisInvalidoError('Falha ao obter país.')
    );
  });

  it('deve lançar PaisInvalidoError quando o repositório falhar', async () => {
    repoMock.queryData.mockRejectedValueOnce(new Error('Erro de banco de dados'));

    const useCase = new ObterPaisUseCase(repoMock);
    const event = createEvent({ id: '123' });

    await expect(useCase.execute(event)).rejects.toThrow(
      new PaisInvalidoError('Falha ao obter país.')
    );
  });

  it('deve utilizar o nome da tabela da variável de ambiente', async () => {
    const originalEnv = process.env.TABELA_PAISES;
    process.env.TABELA_PAISES = 'Tabela_Mock_Obter_Pais';

    try {
      repoMock.queryData.mockResolvedValueOnce({ data: [paisMockData] } as ResultType);
      const useCase = new ObterPaisUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.queryData).toHaveBeenCalledWith('Tabela_Mock_Obter_Pais', expect.any(Array));
    } finally {
      process.env.TABELA_PAISES = originalEnv;
    }
  });
});
