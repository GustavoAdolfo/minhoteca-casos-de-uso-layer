import { AlterarAutorUseCase } from '../../../layer/nodejs/src/autor/alterar-autor';
import { RepositoryInterface, ResultType } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';

// Realizamos o mock parcial da camada core para isolar os testes do UseCase
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

describe('AlterarAutorUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const autorMockData = {
    id: '1234567890',
    nome: 'autor-mock-name',
    totalLivros: 3,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock básico do repositório
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

  const createEvent = (body: Record<string, unknown> | null): APIGatewayEvent =>
    ({
      body: body ? JSON.stringify(body) : null,
    }) as APIGatewayEvent;

  it('deve alterar um autor com sucesso', async () => {
    const mockResult: ResultType = {
      data: [autorMockData], // Esperado por createResult caso exista retorno
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.updateByMinhotecaId.mockResolvedValueOnce(mockResult);

    const useCase = new AlterarAutorUseCase(repoMock);
    const event = createEvent(autorMockData);
    const result = await useCase.execute(event);

    expect(repoMock.updateByMinhotecaId).toHaveBeenCalledWith(
      'Autores',
      expect.objectContaining({ nome: autorMockData.nome }), // Valida parte do objeto gerado pela entidade
      autorMockData.id
    );
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Autor alterado com sucesso');
    expect(result.PageData).toEqual([autorMockData]);
  });

  it('deve lançar erro quando o ID da autor não for informado (ou for vazio)', async () => {
    const dataWithoutId = { ...autorMockData, id: '   ' };
    const useCase = new AlterarAutorUseCase(repoMock);
    const event = createEvent(dataWithoutId);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar Autor.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro quando o body do evento for vazio', async () => {
    const useCase = new AlterarAutorUseCase(repoMock);
    const event = createEvent(null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar Autor.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro genérico quando houver uma falha interna (ex: erro no repositório)', async () => {
    repoMock.updateByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco'));

    const useCase = new AlterarAutorUseCase(repoMock);
    const event = createEvent(autorMockData);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar Autor.');
  });

  it('deve lançar erro quando houver erro de parsing no JSON (body inválido)', async () => {
    const useCase = new AlterarAutorUseCase(repoMock);
    const event = { body: '{ json-invalido ' } as APIGatewayEvent;

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar Autor.');
  });
});
