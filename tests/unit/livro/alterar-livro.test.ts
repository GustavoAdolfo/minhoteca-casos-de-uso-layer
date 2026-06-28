import { AlterarLivroUseCase } from '../../../layer/nodejs/src/livro/alterar-livro';
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

describe('AlterarLivroUseCase', () => {
  let repoMock: jest.Mocked<RepositoryInterface>;
  const idExecucao = 'test-execution-id';

  const livroMockData = {
    id: '1cc97df5bfa64cf9b5ff44734a7e4521',
    titulo: 'Batman e Filho',
    subtitulo: 'A Lenda do Batman - Volume 1',
    isbn: '9788543908366',
    autorId: '9264cb73-1ac9-422c-a07f-26d3ba3af2ed',
    editoraId: 'd98a30cf69ba45e3ac4477877073ad9c',
    anoPublicacao: 2019,
    sinopse:
      "Quando aquela que o Batman um dia amou, Talia, filha de um dos maiores inimidos do Cavaleiro das Trevas, Ra''s Al Ghul, reaparece com um exército de Morcegos-Humanos, ela tem uma outra surpresa para o herói - seu filho. Damian Wayne foi criado com a brutal Liga dos Assassions, e seu ímpeto violento e agressivo ameaça demolir o mundo do Homem-Morcego.",
    status: 'DISPONIVEL',
    revisar: false,
    autor: undefined,
    editora: undefined,
    idioma: 'Português',
    imagemCapaMiniUrl: undefined,
    imagemCapaUrl: '64a8ec23d1a011ed9aae204747fd3490.jpg',
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

  it('deve alterar um livro com sucesso', async () => {
    const mockResult: ResultType = {
      data: [livroMockData], // Esperado por createResult caso exista retorno
      limit: 1,
      currentPage: 1,
      totalPages: 1,
      totalDocuments: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };
    repoMock.updateByMinhotecaId.mockResolvedValueOnce(mockResult);

    const useCase = new AlterarLivroUseCase(repoMock, idExecucao);
    const event = createEvent(livroMockData);
    const result = await useCase.execute(event);

    expect(repoMock.updateByMinhotecaId).toHaveBeenCalledWith(
      'Livros',
      expect.objectContaining({ titulo: livroMockData.titulo }), // Valida parte do objeto gerado pela entidade
      livroMockData.id
    );
    expect(result.Code).toBe(200);
    expect(result.Message).toBe('Livro alterado com sucesso');
    expect(result.PageData).toEqual([livroMockData]);
  });

  it('deve lançar erro quando o ID da autor não for informado (ou for vazio)', async () => {
    const dataWithoutId = { ...livroMockData, id: '   ' };
    const useCase = new AlterarLivroUseCase(repoMock, idExecucao);
    const event = createEvent(dataWithoutId);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar livro.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro quando o body do evento for vazio', async () => {
    const useCase = new AlterarLivroUseCase(repoMock, idExecucao);
    const event = createEvent(null);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar livro.');
    expect(repoMock.updateByMinhotecaId).not.toHaveBeenCalled();
  });

  it('deve lançar erro genérico quando houver uma falha interna (ex: erro no repositório)', async () => {
    repoMock.updateByMinhotecaId.mockRejectedValueOnce(new Error('Erro interno no banco'));

    const useCase = new AlterarLivroUseCase(repoMock, idExecucao);
    const event = createEvent(livroMockData);

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar livro.');
  });

  it('deve lançar erro quando houver erro de parsing no JSON (body inválido)', async () => {
    const useCase = new AlterarLivroUseCase(repoMock, idExecucao);
    const event = { body: '{ json-invalido ' } as APIGatewayEvent;

    await expect(useCase.execute(event)).rejects.toThrow('Falha ao alterar livro.');
  });
});
