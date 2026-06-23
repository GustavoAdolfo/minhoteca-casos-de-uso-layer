import { ExcluirPaisUseCase } from '../../../layer/nodejs/src/pais/excluir-pais';
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

describe('ExcluirPaisUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const mockResult: ResultType = {
    data: [],
    limit: 1,
    currentPage: 1,
    totalPages: 1,
    totalDocuments: 1,
    hasNextPage: false,
    hasPrevPage: false,
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
    queryStringParameters: Record<string, string> | null = null
  ): APIGatewayEvent =>
    ({
      queryStringParameters,
    }) as unknown as APIGatewayEvent;

  it('deve excluir um país com sucesso quando o id for informado e não houver autores associados', async () => {
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
    repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
    const useCase = new ExcluirPaisUseCase(repoMock);

    const event = createEvent({ id: '76' }); // ID do Brasil
    const result = await useCase.execute(event);

    expect(repoMock.getAll).toHaveBeenCalledWith('Autores', {
      filterKey: 'paisId',
      filterValue: '76',
    });
    expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Paises', '76');
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('País excluído com sucesso.');
  });

  it('deve lançar PaisInvalidoError quando existirem autores associados ao país', async () => {
    repoMock.getAll.mockResolvedValueOnce({
      data: [{ id: 'autor-1', nome: 'Autor Teste' }],
    } as unknown as ResultType);

    const useCase = new ExcluirPaisUseCase(repoMock);
    const event = createEvent({ id: '76' });

    await expect(useCase.execute(event)).rejects.toThrow(
      new PaisInvalidoError(
        'Não é possível excluir o país porque existem autores associados a ele.'
      )
    );

    expect(repoMock.getAll).toHaveBeenCalled();
    expect(repoMock.deleteByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar PaisInvalidoError quando o ID do país não for informado', async () => {
    const useCase = new ExcluirPaisUseCase(repoMock);

    const event = createEvent(null);
    await expect(useCase.execute(event)).rejects.toThrow(
      new PaisInvalidoError('ID do país é obrigatório para exclusão.')
    );
  });

  it('deve utilizar os nomes das tabelas das variáveis de ambiente', async () => {
    const originalEnvPaises = process.env.TABELA_PAISES;
    const originalEnvAutores = process.env.TABELA_AUTORES;
    process.env.TABELA_PAISES = 'Tabela_Mock_Pais';
    process.env.TABELA_AUTORES = 'Tabela_Mock_Autor';

    try {
      repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
      repoMock.deleteByMinhotecaId.mockResolvedValueOnce(mockResult);
      const useCase = new ExcluirPaisUseCase(repoMock);

      await useCase.execute(createEvent({ id: '999' }));
      expect(repoMock.getAll).toHaveBeenCalledWith('Tabela_Mock_Autor', expect.any(Object));
      expect(repoMock.deleteByMinhotecaId).toHaveBeenCalledWith('Tabela_Mock_Pais', '999');
    } finally {
      process.env.TABELA_PAISES = originalEnvPaises;
      process.env.TABELA_AUTORES = originalEnvAutores;
    }
  });

  it('deve lançar PaisInvalidoError quando o repositório falhar na exclusão', async () => {
    repoMock.getAll.mockResolvedValueOnce({ data: [] } as unknown as ResultType);
    repoMock.deleteByMinhotecaId.mockRejectedValueOnce(new Error('Erro de banco de dados'));
    const useCase = new ExcluirPaisUseCase(repoMock);

    await expect(useCase.execute(createEvent({ id: '76' }))).rejects.toThrow(
      new PaisInvalidoError('Falha ao excluir país.')
    );
    const logServiceInstance = (LogService as jest.Mock).mock.results[0].value;
    expect(logServiceInstance.error).toHaveBeenCalled();
  });
});
