import { AlterarEditoraUseCase } from '../../../layer/nodejs/src/editora/alterar-editora';
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

describe('AlterarEditoraUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;

  const editoraMockData = {
    id: '1234567890',
    nome: 'editora-mock-name',
    email: 'editora-mock@email.net',
    website: 'http://editora-mock-website.com',
    pais: 'BRA',
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

  it('deve alterar uma editora com sucesso', async () => {
    const mockResult: ResultType = {
      data: [editoraMockData], // Esperado por createResult caso exista retorno
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.updateByMinhotecaId.mockResolvedValueOnce(mockResult);

    const useCase = new AlterarEditoraUseCase(repoMock);
    const event = createEvent(editoraMockData);
    const result = await useCase.execute(event);

    expect(repoMock.updateByMinhotecaId).toHaveBeenCalledWith(
      'Editoras',
      expect.objectContaining({ nome: editoraMockData.nome }), // Valida parte do objeto gerado pela entidade
      editoraMockData.id
    );
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Editora alterada com sucesso');
    expect(result.PageData).toEqual([editoraMockData]);
  });

  it('deve lançar erro quando o ID da editora não for informado (ou for vazio)', async () => {
    const dataWithoutId = { ...editoraMockData, id: '   ' };
    const useCase = new AlterarEditoraUseCase(repoMock);
    const event = createEvent(dataWithoutId);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar editora.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro quando o body do evento for vazio', async () => {
    const useCase = new AlterarEditoraUseCase(repoMock);
    const event = createEvent(null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar editora.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro genérico quando houver uma falha interna (ex: erro no repositório)', async () => {
    repoMock.updateByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco'));

    const useCase = new AlterarEditoraUseCase(repoMock);
    const event = createEvent(editoraMockData);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar editora.');
  });

  it('deve lançar erro quando houver erro de parsing no JSON (body inválido)', async () => {
    const useCase = new AlterarEditoraUseCase(repoMock);
    const event = { body: '{ json-invalido ' } as APIGatewayEvent;

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar editora.');
  });
});
