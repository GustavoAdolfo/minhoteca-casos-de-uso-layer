import {
  LivroDTO,
  LivroAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  LivroInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda/trigger/api-gateway-proxy';
import { createResult } from '../util';

export class CriarLivroUseCase implements UseCaseInterface {
  private _tabelaLivros: string;
  private logService = new LogService('CriarLivroUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaLivros = process.env.TABELA_LIVROS ?? 'Livros';
  }

  async execute(data: APIGatewayEvent, idExecucao?: string): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso CriarLivroUseCase',
      { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
      { data }
    );
    try {
      const body = JSON.parse(data.body ?? '{}');
      this.logService.info(
        'Dados recebidos para gravação',
        { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { body }
      );

      const entity = LivroAdapter.fromCreateDTO(body);
      this.logService.info(
        'Dados convertidos para entidade',
        { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );

      await this._repository.saveData(this._tabelaLivros, JSON.parse(entity.toJSONString()));
      this.logService.info(
        'Livro gravado com sucesso',
        { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { entity }
      );
      const livroDTO: LivroDTO = LivroAdapter.toDTO(entity);

      this.logService.info(
        'Dados convertidos para DTO de retorno',
        { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        { livroDTO }
      );
      return createResult([livroDTO], 201, 'Livro criado com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao criar livro:',
        { label: 'CriarLivroUseCase', ...(idExecucao && { logId: idExecucao }) },
        error as Error,
        { data }
      );
      throw new LivroInvalidoError('Falha ao criar livro.');
    }
  }
}
